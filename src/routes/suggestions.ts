import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import type { Database } from '../db/index.js';
import { connections, profiles, suggestionDismissals, invites } from '../db/schema/index.js';
import { and, eq, ne, notInArray, sql, count, gt } from 'drizzle-orm';
import { createAuthMiddleware, getAuthContext } from '../middleware/auth.js';

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
    const limit = Math.min(parseInt(query.limit ?? '50', 10) || 50, 100);

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

    // Fetch suggestions with profile join to determine claimed status
    const suggestions = await db
      .select({
        subjectDid: connections.subjectDid,
        source: connections.source,
        createdAt: connections.createdAt,
        handle: profiles.handle,
        displayName: profiles.displayName,
        headline: profiles.headline,
        avatarUrl: profiles.avatarUrl,
        profileExists: sql<boolean>`${profiles.did} IS NOT NULL`,
      })
      .from(connections)
      .leftJoin(profiles, eq(connections.subjectDid, profiles.did))
      .where(and(...conditions))
      .orderBy(connections.createdAt)
      .limit(limit + 1); // +1 for cursor detection

    const hasMore = suggestions.length > limit;
    const items = hasMore ? suggestions.slice(0, limit) : suggestions;

    // Check dismissed status if including dismissed
    let dismissedSet = new Set<string>();
    if (includeDismissed) {
      const dismissed = await db
        .select({ subjectDid: suggestionDismissals.subjectDid })
        .from(suggestionDismissals)
        .where(eq(suggestionDismissals.userDid, did));
      dismissedSet = new Set(dismissed.map((d) => d.subjectDid));
    }

    // Determine claimed status by checking sessions table
    let claimedSet = new Set<string>();
    if (items.length > 0) {
      const claimedDids = await db
        .select({ did: sql<string>`DISTINCT did` })
        .from(sql`sessions`)
        .where(
          sql`did IN (${sql.join(
            items.map((i) => sql`${i.subjectDid}`),
            sql`,`,
          )})`,
        );
      claimedSet = new Set(claimedDids.map((r) => r.did));
    }

    const onSifa = items
      .filter((i) => claimedSet.has(i.subjectDid))
      .map((i) => ({
        did: i.subjectDid,
        handle: i.handle ?? '',
        displayName: i.displayName ?? undefined,
        headline: i.headline ?? undefined,
        avatarUrl: i.avatarUrl ?? undefined,
        source: i.source,
        dismissed: dismissedSet.has(i.subjectDid),
      }));

    const notOnSifa = items
      .filter((i) => !claimedSet.has(i.subjectDid))
      .map((i) => ({
        did: i.subjectDid,
        handle: i.handle ?? '',
        displayName: i.displayName ?? undefined,
        source: i.source,
        dismissed: dismissedSet.has(i.subjectDid),
      }));

    return reply.send({
      onSifa,
      notOnSifa,
      cursor: hasMore ? items[items.length - 1]?.createdAt?.toISOString() : undefined,
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
