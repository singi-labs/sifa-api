import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { eq, and, gt } from 'drizzle-orm';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import { Agent } from '@atproto/api';
import type { Database } from '../db/index.js';
import { sessions, profiles, oauthSessions } from '../db/schema/index.js';
import { importBlueskyFollows } from '../services/bluesky-follows.js';
import { importTangledFollows } from '../services/tangled-follows.js';

const loginSchema = z.object({
  handle: z.string().min(1).max(253),
});

export function registerOAuthRoutes(
  app: FastifyInstance,
  db: Database,
  oauthClient: NodeOAuthClient | null,
) {
  // Login: initiate OAuth flow (stricter rate limit for auth endpoint)
  app.post(
    '/oauth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = loginSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: 'InvalidRequest', message: 'Handle is required' });
      }

      if (!oauthClient) {
        return reply.status(503).send({ error: 'Unavailable', message: 'OAuth not configured' });
      }

      const granularScope = [
        'atproto',
        'repo:id.sifa.profile.self',
        'repo:id.sifa.profile.position',
        'repo:id.sifa.profile.education',
        'repo:id.sifa.profile.skill',
        'repo:id.sifa.profile.certification',
        'repo:id.sifa.profile.project',
        'repo:id.sifa.profile.volunteering',
        'repo:id.sifa.profile.publication',
        'repo:id.sifa.profile.course',
        'repo:id.sifa.profile.honor',
        'repo:id.sifa.profile.language',
        'repo:id.sifa.profile.externalAccount',
        'repo:id.sifa.graph.follow',
      ].join(' ');

      let url: URL;
      try {
        url = await oauthClient.authorize(body.data.handle, {
          scope: granularScope,
          prompt: 'login',
        });
      } catch {
        // PDS may not support granular scopes — fall back to transition:generic
        app.log.warn(
          { handle: body.data.handle },
          'Granular scopes rejected by PDS, falling back to transition:generic',
        );
        url = await oauthClient.authorize(body.data.handle, {
          scope: 'atproto transition:generic',
          prompt: 'login',
        });
      }

      return reply.send({ redirectUrl: url.toString() });
    },
  );

  // Callback: exchange code for tokens
  app.get(
    '/oauth/callback',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const params = new URLSearchParams(request.url.split('?')[1] ?? '');
      if (!params.get('code') || !params.get('state')) {
        return reply
          .status(400)
          .send({ error: 'InvalidRequest', message: 'Missing code or state' });
      }

      if (!oauthClient) {
        return reply.status(503).send({ error: 'Unavailable', message: 'OAuth not configured' });
      }

      const { session } = await oauthClient.callback(params);
      const did = session.did;

      // Create a secure session ID (not the DID)
      const sessionId = randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // 180 days

      await db.insert(sessions).values({
        id: sessionId,
        did,
        createdAt: now,
        expiresAt,
      });

      // Set session cookie to the random sessionId (NOT the DID)
      reply.setCookie('session', sessionId, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 180 * 24 * 60 * 60, // 180 days
      });

      // Sync Bluesky profile and detect first login
      let isNewUser = false;
      try {
        const [existing] = await db
          .select({ did: profiles.did })
          .from(profiles)
          .where(eq(profiles.did, did))
          .limit(1);
        isNewUser = !existing;

        const publicAgent = new Agent('https://public.api.bsky.app');
        const bskyProfile = await publicAgent.getProfile(
          { actor: did },
          { signal: AbortSignal.timeout(3000) },
        );
        await db
          .insert(profiles)
          .values({
            did,
            handle: bskyProfile.data.handle,
            displayName: bskyProfile.data.displayName ?? null,
            avatarUrl: bskyProfile.data.avatar ?? null,
            createdAt: now,
          })
          .onConflictDoUpdate({
            target: profiles.did,
            set: {
              handle: bskyProfile.data.handle,
              displayName: bskyProfile.data.displayName ?? null,
              avatarUrl: bskyProfile.data.avatar ?? null,
              updatedAt: now,
            },
          });
      } catch (err) {
        app.log.error({ err, did }, 'Profile sync on login failed');
      }

      // Import follows from Bluesky and Tangled (fire-and-forget, non-blocking)
      void (async () => {
        try {
          const agent = new Agent(session);

          // Import Bluesky follows
          const bskyFollows: Array<{ did: string; handle: string; createdAt: string }> = [];
          let cursor: string | undefined;
          do {
            const res = await agent.getFollows({ actor: did, limit: 100, cursor });
            for (const f of res.data.follows) {
              bskyFollows.push({
                did: f.did,
                handle: f.handle,
                createdAt: f.indexedAt ?? new Date().toISOString(),
              });
            }
            cursor = res.data.cursor;
          } while (cursor);
          await importBlueskyFollows(db, did, bskyFollows);
          app.log.info({ did, count: bskyFollows.length }, 'Imported Bluesky follows');

          // Import Tangled follows (read from user's PDS repo)
          try {
            const tangledFollows: Array<{ did: string; handle: string; createdAt: string }> = [];
            let tangledCursor: string | undefined;
            do {
              const res = await agent.com.atproto.repo.listRecords({
                repo: did,
                collection: 'sh.tangled.graph.follow',
                limit: 100,
                cursor: tangledCursor,
              });
              for (const record of res.data.records) {
                const val = record.value as { subject?: string; createdAt?: string };
                if (val.subject) {
                  tangledFollows.push({
                    did: val.subject,
                    handle: '', // We don't have the handle from PDS records
                    createdAt: val.createdAt ?? new Date().toISOString(),
                  });
                }
              }
              tangledCursor = res.data.cursor;
            } while (tangledCursor);
            await importTangledFollows(db, did, tangledFollows);
            app.log.info({ did, count: tangledFollows.length }, 'Imported Tangled follows');
          } catch (err) {
            // User may not have any Tangled records — this is expected
            app.log.debug({ err, did }, 'Tangled follow import skipped or failed');
          }
        } catch (err) {
          app.log.error({ err, did }, 'Follow import on login failed');
        }
      })();

      // New users go to import; returning users go home (frontend reads sessionStorage returnTo)
      return reply.redirect(isNewUser ? '/import' : '/');
    },
  );

  // Logout
  app.post(
    '/oauth/logout',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const sessionId = request.cookies?.session;
      if (sessionId) {
        // Look up the DID before deleting the session row
        const [row] = await db
          .select({ did: sessions.did })
          .from(sessions)
          .where(eq(sessions.id, sessionId))
          .limit(1);

        await db.delete(sessions).where(eq(sessions.id, sessionId));

        // Clear OAuth tokens: revoke at PDS + delete from local store
        if (row?.did) {
          // Direct DB delete ensures local tokens are always cleared
          await db
            .delete(oauthSessions)
            .where(eq(oauthSessions.did, row.did))
            .catch((err: unknown) => {
              app.log.warn({ err, did: row.did }, 'OAuth session DB cleanup failed');
            });

          // Also try PDS-level revocation (best effort)
          if (oauthClient) {
            await oauthClient.revoke(row.did).catch(() => {});
          }
        }
      }
      reply.clearCookie('session', { path: '/' });
      return reply.send({ status: 'ok' });
    },
  );

  // Session info
  app.get(
    '/api/auth/session',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const sessionId = request.cookies?.session;
      if (!sessionId) {
        return reply.send({ authenticated: false });
      }

      if (!oauthClient) {
        return reply.status(503).send({ error: 'Unavailable' });
      }

      // Look up session from DB
      const [row] = await db
        .select({ did: sessions.did })
        .from(sessions)
        .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
        .limit(1);

      if (!row) {
        reply.clearCookie('session', { path: '/' });
        return reply.status(401).send({ error: 'SessionExpired' });
      }

      try {
        await oauthClient.restore(row.did);

        // Read profile from local DB (synced on login)
        const [profile] = await db
          .select({
            handle: profiles.handle,
            displayName: profiles.displayName,
            avatarUrl: profiles.avatarUrl,
            updatedAt: profiles.updatedAt,
          })
          .from(profiles)
          .where(eq(profiles.did, row.did))
          .limit(1);

        const STALE_MS = 12 * 60 * 60 * 1000; // 12 hours

        if (!profile) {
          // Profile not yet synced locally — resolve from Bluesky and trigger sync
          const publicAgent = new Agent('https://public.api.bsky.app');
          const bskyProfile = await publicAgent.getProfile(
            { actor: row.did },
            { signal: AbortSignal.timeout(3000) },
          );

          // Fire-and-forget: persist for next request
          const now = new Date();
          void db
            .insert(profiles)
            .values({
              did: row.did,
              handle: bskyProfile.data.handle,
              displayName: bskyProfile.data.displayName ?? null,
              avatarUrl: bskyProfile.data.avatar ?? null,
              createdAt: now,
            })
            .onConflictDoUpdate({
              target: profiles.did,
              set: {
                handle: bskyProfile.data.handle,
                displayName: bskyProfile.data.displayName ?? null,
                avatarUrl: bskyProfile.data.avatar ?? null,
                updatedAt: now,
              },
            })
            .catch((err: unknown) => {
              app.log.error({ err, did: row.did }, 'Session profile sync failed');
            });

          return reply.send({
            authenticated: true,
            did: row.did,
            handle: bskyProfile.data.handle,
            displayName: bskyProfile.data.displayName,
            avatar: bskyProfile.data.avatar,
          });
        }

        // Auto-refresh stale profiles (>12h since last update)
        const isStale = Date.now() - profile.updatedAt.getTime() > STALE_MS;
        if (isStale) {
          const publicAgent = new Agent('https://public.api.bsky.app');
          void publicAgent
            .getProfile({ actor: row.did }, { signal: AbortSignal.timeout(3000) })
            .then((bskyProfile) => {
              const now = new Date();
              return db
                .update(profiles)
                .set({
                  handle: bskyProfile.data.handle,
                  displayName: bskyProfile.data.displayName ?? null,
                  avatarUrl: bskyProfile.data.avatar ?? null,
                  updatedAt: now,
                })
                .where(eq(profiles.did, row.did));
            })
            .catch((err: unknown) => {
              app.log.warn({ err, did: row.did }, 'Stale profile auto-refresh failed');
            });
        }

        return reply.send({
          authenticated: true,
          did: row.did,
          handle: profile.handle,
          displayName: profile.displayName,
          avatar: profile.avatarUrl,
        });
      } catch {
        reply.clearCookie('session', { path: '/' });
        return reply.status(401).send({ error: 'SessionExpired' });
      }
    },
  );
}
