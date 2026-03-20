import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Agent } from '@atproto/api';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import type { Database } from '../db/index.js';
import { connections, profiles, suggestionDismissals, invites } from '../db/schema/index.js';
import { and, eq, ne, notInArray, sql, count, gt } from 'drizzle-orm';
import { createAuthMiddleware, getAuthContext } from '../middleware/auth.js';
import { fetchBlueskyFollowsFromPds, importBlueskyFollows } from '../services/bluesky-follows.js';
import { fetchTangledFollowsFromPds, importTangledFollows } from '../services/tangled-follows.js';
import {
  resolveAndUpsertProfiles,
  fetchProfilesFromBluesky,
} from '../services/profile-resolver.js';

const dismissSchema = z.object({
  subjectDid: z.string().startsWith('did:'),
});

const inviteSchema = z.object({
  subjectDid: z.string().startsWith('did:'),
});

export function registerSuggestionRoutes(
  app: FastifyInstance,
  db: Database,
  oauthClient: NodeOAuthClient | null,
  publicUrl: string,
) {
  const requireAuth = createAuthMiddleware(oauthClient, db);

  // GET /api/suggestions -- list follow suggestions
  app.get('/api/suggestions', { preHandler: requireAuth }, async (request, reply) => {
    const { did } = getAuthContext(request);
    const query = request.query as {
      source?: string;
      include_dismissed?: string;
      limit?: string;
      cursor?: string;
    };

    const source = query.source;
    const includeDismissed = query.include_dismissed === 'true';
    const limit = Math.min(parseInt(query.limit ?? '20', 10) || 20, 100);

    // Get DIDs already followed on Sifa
    const sifaFollowedDids = db
      .select({ subjectDid: connections.subjectDid })
      .from(connections)
      .where(and(eq(connections.followerDid, did), eq(connections.source, 'sifa')));

    // Get dismissed DIDs (unless including them)
    const dismissedDids = includeDismissed
      ? null
      : db
          .select({ subjectDid: suggestionDismissals.subjectDid })
          .from(suggestionDismissals)
          .where(eq(suggestionDismissals.userDid, did));

    // Build conditions for cross-network follows
    const conditions = [
      eq(connections.followerDid, did),
      ne(connections.source, 'sifa'),
      notInArray(connections.subjectDid, sifaFollowedDids),
    ];

    if (source) {
      conditions.push(eq(connections.source, source));
    }
    if (dismissedDids) {
      conditions.push(notInArray(connections.subjectDid, dismissedDids));
    }

    // Check dismissed status if including dismissed
    let dismissedSet = new Set<string>();
    if (includeDismissed) {
      const dismissed = await db
        .select({ subjectDid: suggestionDismissals.subjectDid })
        .from(suggestionDismissals)
        .where(eq(suggestionDismissals.userDid, did));
      dismissedSet = new Set(dismissed.map((d) => d.subjectDid));
    }

    // Query "On Sifa" suggestions separately (uncapped — these are high-value)
    const onSifaConditions = [
      ...conditions,
      sql`${connections.subjectDid} IN (SELECT DISTINCT did FROM sessions)`,
    ];
    const onSifaRows = await db
      .select({
        subjectDid: connections.subjectDid,
        source: connections.source,
        handle: profiles.handle,
        displayName: profiles.displayName,
        headline: profiles.headline,
        avatarUrl: profiles.avatarUrl,
      })
      .from(connections)
      .leftJoin(profiles, eq(connections.subjectDid, profiles.did))
      .where(and(...onSifaConditions));

    const onSifa = onSifaRows.map((i) => ({
      did: i.subjectDid,
      handle: i.handle ?? '',
      displayName: i.displayName ?? undefined,
      headline: i.headline ?? undefined,
      avatarUrl: i.avatarUrl ?? undefined,
      source: i.source,
      dismissed: dismissedSet.has(i.subjectDid),
    }));

    // Query "Not on Sifa" suggestions (paginated)
    const notOnSifaConditions = [
      ...conditions,
      sql`${connections.subjectDid} NOT IN (SELECT DISTINCT did FROM sessions)`,
    ];
    const notOnSifaRows = await db
      .select({
        subjectDid: connections.subjectDid,
        source: connections.source,
        createdAt: connections.createdAt,
        handle: profiles.handle,
        displayName: profiles.displayName,
        avatarUrl: profiles.avatarUrl,
      })
      .from(connections)
      .leftJoin(profiles, eq(connections.subjectDid, profiles.did))
      .where(and(...notOnSifaConditions))
      .orderBy(connections.createdAt)
      .limit(limit + 1);

    const hasMore = notOnSifaRows.length > limit;
    const notOnSifaItems = hasMore ? notOnSifaRows.slice(0, limit) : notOnSifaRows;

    // Enrich "Not on Sifa" results with Bluesky profile data (without persisting)
    const didsNeedingProfiles = notOnSifaItems.filter((i) => !i.handle).map((i) => i.subjectDid);
    const enriched =
      didsNeedingProfiles.length > 0
        ? await fetchProfilesFromBluesky(didsNeedingProfiles, app.log)
        : [];
    const enrichedMap = new Map(enriched.map((p) => [p.did, p]));

    const notOnSifa = notOnSifaItems.map((i) => {
      const bsky = enrichedMap.get(i.subjectDid);
      return {
        did: i.subjectDid,
        handle: i.handle || bsky?.handle || '',
        displayName: i.displayName ?? bsky?.displayName,
        avatarUrl: i.avatarUrl ?? bsky?.avatarUrl,
        source: i.source,
        dismissed: dismissedSet.has(i.subjectDid),
      };
    });

    return reply.send({
      onSifa,
      notOnSifa,
      cursor: hasMore
        ? notOnSifaItems[notOnSifaItems.length - 1]?.createdAt?.toISOString()
        : undefined,
    });
  });

  // GET /api/suggestions/count -- lightweight count for nav badge
  app.get('/api/suggestions/count', { preHandler: requireAuth }, async (request, reply) => {
    const { did } = getAuthContext(request);
    const query = request.query as { since?: string };

    const sifaFollowedDids = db
      .select({ subjectDid: connections.subjectDid })
      .from(connections)
      .where(and(eq(connections.followerDid, did), eq(connections.source, 'sifa')));

    const dismissedDids = db
      .select({ subjectDid: suggestionDismissals.subjectDid })
      .from(suggestionDismissals)
      .where(eq(suggestionDismissals.userDid, did));

    const conditions = [
      eq(connections.followerDid, did),
      ne(connections.source, 'sifa'),
      notInArray(connections.subjectDid, sifaFollowedDids),
      notInArray(connections.subjectDid, dismissedDids),
      // Only count people who are actually on Sifa (have logged in)
      sql`${connections.subjectDid} IN (SELECT DISTINCT did FROM sessions)`,
    ];

    if (query.since) {
      conditions.push(gt(connections.indexedAt, new Date(query.since)));
    }

    const [result] = await db
      .select({ value: count() })
      .from(connections)
      .where(and(...conditions));

    return reply.send({ count: result?.value ?? 0 });
  });

  // POST /api/suggestions/dismiss
  app.post('/api/suggestions/dismiss', { preHandler: requireAuth }, async (request, reply) => {
    const body = dismissSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'InvalidRequest', issues: body.error.issues });
    }

    const { did } = getAuthContext(request);

    await db
      .insert(suggestionDismissals)
      .values({
        userDid: did,
        subjectDid: body.data.subjectDid,
      })
      .onConflictDoNothing();

    return reply.status(200).send({ status: 'ok' });
  });

  // DELETE /api/suggestions/dismiss/:did -- unhide
  app.delete<{ Params: { did: string } }>(
    '/api/suggestions/dismiss/:did',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { did: userDid } = getAuthContext(request);
      const { did: subjectDid } = request.params;

      await db
        .delete(suggestionDismissals)
        .where(
          and(
            eq(suggestionDismissals.userDid, userDid),
            eq(suggestionDismissals.subjectDid, subjectDid),
          ),
        );

      return reply.status(200).send({ status: 'ok' });
    },
  );

  // POST /api/suggestions/sync -- re-import follows from PDS
  app.post(
    '/api/suggestions/sync',
    { preHandler: requireAuth, config: { rateLimit: { max: 3, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { did, session } = getAuthContext(request);
      const agent = new Agent(session);

      let blueskyCount = 0;
      let tangledCount = 0;

      // Import Bluesky follows
      try {
        const bskyFollows = await fetchBlueskyFollowsFromPds(agent, did);
        await importBlueskyFollows(db, did, bskyFollows);
        blueskyCount = bskyFollows.length;
        app.log.info({ did, count: blueskyCount }, 'Synced Bluesky follows');
      } catch (err) {
        app.log.error({ err, did }, 'Bluesky follow sync failed');
      }

      // Import Tangled follows
      try {
        const tangledFollows = await fetchTangledFollowsFromPds(agent, did);
        await importTangledFollows(db, did, tangledFollows);
        tangledCount = tangledFollows.length;
        app.log.info({ did, count: tangledCount }, 'Synced Tangled follows');
      } catch (err) {
        app.log.debug({ err, did }, 'Tangled follow sync skipped or failed');
      }

      // Only resolve profiles for DIDs that are actual Sifa users (have sessions)
      // Do NOT insert profiles for random Bluesky follows — that pollutes the DB.
      const claimedFollowDids = await db
        .select({ subjectDid: connections.subjectDid })
        .from(connections)
        .where(
          and(
            eq(connections.followerDid, did),
            ne(connections.source, 'sifa'),
            sql`${connections.subjectDid} IN (SELECT DISTINCT did FROM sessions)`,
          ),
        );
      const claimedDids = claimedFollowDids.map((r) => r.subjectDid);
      if (claimedDids.length > 0) {
        try {
          const resolved = await resolveAndUpsertProfiles(db, claimedDids, app.log);
          app.log.info({ did, resolved }, 'Resolved profiles for On Sifa suggestions');
        } catch (err) {
          app.log.error({ err, did }, 'Profile resolution for suggestions failed');
        }
      }

      return reply.send({
        status: 'ok',
        imported: { bluesky: blueskyCount, tangled: tangledCount },
      });
    },
  );

  // POST /api/invites
  app.post('/api/invites', { preHandler: requireAuth }, async (request, reply) => {
    const body = inviteSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'InvalidRequest', issues: body.error.issues });
    }

    const { did } = getAuthContext(request);

    await db
      .insert(invites)
      .values({
        inviterDid: did,
        subjectDid: body.data.subjectDid,
      })
      .onConflictDoNothing();

    const inviteUrl = `${publicUrl}/claim?ref=${encodeURIComponent(body.data.subjectDid)}`;

    return reply.status(201).send({ inviteUrl });
  });
}
