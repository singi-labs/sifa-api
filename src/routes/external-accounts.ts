import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import type { Database } from '../db/index.js';
import type { ValkeyClient } from '../cache/index.js';
import { externalAccounts, externalAccountVerifications, profiles } from '../db/schema/index.js';
import { externalAccountSchema } from './schemas.js';
import { generateTid, buildApplyWritesOp, writeToUserPds } from '../services/pds-writer.js';
import { createAuthMiddleware, getAuthContext } from '../middleware/auth.js';
import { discoverFeedUrl, fetchFeedItems } from '../services/feed-discovery.js';
import { checkAndStoreVerification, isVerifiablePlatform } from '../services/verification.js';

const FEED_CACHE_TTL = 1800; // 30 minutes

export function registerExternalAccountRoutes(
  app: FastifyInstance,
  db: Database,
  oauthClient: NodeOAuthClient | null,
  valkey: ValkeyClient | null,
) {
  const requireAuth = createAuthMiddleware(oauthClient, db);

  // POST /api/profile/external-accounts -- create a new external account
  app.post(
    '/api/profile/external-accounts',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = externalAccountSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'ValidationError', issues: parsed.error.issues });
      }

      const { did, session } = getAuthContext(request);
      const rkey = generateTid();

      let feedUrl = parsed.data.feedUrl;
      if (!feedUrl) {
        feedUrl = (await discoverFeedUrl(parsed.data.platform, parsed.data.url)) ?? undefined;
      }

      const record: Record<string, unknown> = {
        createdAt: new Date().toISOString(),
        platform: parsed.data.platform,
        url: parsed.data.url,
        ...(parsed.data.label ? { label: parsed.data.label } : {}),
        ...(feedUrl ? { feedUrl } : {}),
      };

      await writeToUserPds(session, did, [
        buildApplyWritesOp('create', 'id.sifa.profile.externalAccount', rkey, record),
      ]);

      // Trigger verification in the background
      const [profile] = await db.select().from(profiles).where(eq(profiles.did, did)).limit(1);
      if (profile) {
        void checkAndStoreVerification(
          db,
          did,
          parsed.data.url,
          parsed.data.platform,
          profile.handle,
        );
      }

      return reply.status(201).send({ rkey, feedUrl: feedUrl ?? null });
    },
  );

  // PUT /api/profile/external-accounts/:rkey -- update an external account
  app.put<{ Params: { rkey: string } }>(
    '/api/profile/external-accounts/:rkey',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = externalAccountSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'ValidationError', issues: parsed.error.issues });
      }

      const { did, session } = getAuthContext(request);
      const { rkey } = request.params;

      let feedUrl = parsed.data.feedUrl;
      if (!feedUrl) {
        feedUrl = (await discoverFeedUrl(parsed.data.platform, parsed.data.url)) ?? undefined;
      }

      const record: Record<string, unknown> = {
        createdAt: new Date().toISOString(),
        platform: parsed.data.platform,
        url: parsed.data.url,
        ...(parsed.data.label ? { label: parsed.data.label } : {}),
        ...(feedUrl ? { feedUrl } : {}),
      };

      await writeToUserPds(session, did, [
        buildApplyWritesOp('update', 'id.sifa.profile.externalAccount', rkey, record),
      ]);

      // Re-verify in the background
      const [profile] = await db.select().from(profiles).where(eq(profiles.did, did)).limit(1);
      if (profile) {
        void checkAndStoreVerification(
          db,
          did,
          parsed.data.url,
          parsed.data.platform,
          profile.handle,
        );
      }

      return reply.status(200).send({ ok: true, feedUrl: feedUrl ?? null });
    },
  );

  // DELETE /api/profile/external-accounts/:rkey -- delete an external account
  app.delete<{ Params: { rkey: string } }>(
    '/api/profile/external-accounts/:rkey',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { did, session } = getAuthContext(request);
      const { rkey } = request.params;

      await writeToUserPds(session, did, [
        buildApplyWritesOp('delete', 'id.sifa.profile.externalAccount', rkey),
      ]);

      return reply.status(200).send({ ok: true });
    },
  );

  // GET /api/profile/:handleOrDid/external-accounts -- list external accounts with verification
  app.get<{ Params: { handleOrDid: string } }>(
    '/api/profile/:handleOrDid/external-accounts',
    async (request, reply) => {
      const { handleOrDid } = request.params;
      const isDid = handleOrDid.startsWith('did:');
      const condition = isDid ? eq(profiles.did, handleOrDid) : eq(profiles.handle, handleOrDid);

      const [profile] = await db.select().from(profiles).where(condition).limit(1);
      if (!profile) {
        return reply.status(404).send({ error: 'NotFound', message: 'Profile not found' });
      }

      const accounts = await db
        .select()
        .from(externalAccounts)
        .where(eq(externalAccounts.did, profile.did));

      const verifications = await db
        .select()
        .from(externalAccountVerifications)
        .where(eq(externalAccountVerifications.did, profile.did));

      const verificationMap = new Map(
        verifications.map((v) => [v.url, { verified: v.verified, verifiedVia: v.verifiedVia }]),
      );

      const result = accounts.map((acc) => {
        const verification = verificationMap.get(acc.url);
        const verifiable = isVerifiablePlatform(acc.platform);

        return {
          rkey: acc.rkey,
          platform: acc.platform,
          url: acc.url,
          label: acc.label,
          feedUrl: acc.feedUrl,
          verifiable,
          verified: verification?.verified ?? false,
          verifiedVia: verification?.verifiedVia ?? null,
        };
      });

      return reply.send({ accounts: result });
    },
  );

  // GET /api/profile/:handleOrDid/feed-items -- fetch cached external feed items
  app.get<{ Params: { handleOrDid: string } }>(
    '/api/profile/:handleOrDid/feed-items',
    async (request, reply) => {
      const { handleOrDid } = request.params;
      const isDid = handleOrDid.startsWith('did:');
      const condition = isDid ? eq(profiles.did, handleOrDid) : eq(profiles.handle, handleOrDid);

      const [profile] = await db.select().from(profiles).where(condition).limit(1);
      if (!profile) {
        return reply.status(404).send({ error: 'NotFound', message: 'Profile not found' });
      }

      const accounts = await db
        .select()
        .from(externalAccounts)
        .where(and(eq(externalAccounts.did, profile.did)));

      const feedAccounts = accounts.filter((a) => a.feedUrl);
      const allItems = [];

      for (const acc of feedAccounts) {
        if (!acc.feedUrl) continue;

        const cacheKey = `feed:${profile.did}:${acc.rkey}`;

        if (valkey) {
          const cached = await valkey.get(cacheKey);
          if (cached) {
            const items = JSON.parse(cached) as Array<Record<string, string>>;
            allItems.push(...items);
            continue;
          }
        }

        const sourceLabel = acc.platform === 'fediverse' ? 'Mastodon' : (acc.label ?? acc.platform);
        const items = await fetchFeedItems(acc.feedUrl, sourceLabel);

        if (valkey && items.length > 0) {
          await valkey.setex(cacheKey, FEED_CACHE_TTL, JSON.stringify(items));
        }

        allItems.push(...items);
      }

      // Sort by timestamp descending
      allItems.sort((a, b) => {
        const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tb - ta;
      });

      return reply.send({ items: allItems.slice(0, 50) });
    },
  );
}
