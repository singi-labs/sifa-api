import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import type { Database } from '../db/index.js';
import { connections, profiles } from '../db/schema/index.js';
import { and, eq, lt, sql } from 'drizzle-orm';
import {
  generateTid,
  buildApplyWritesOp,
  writeToUserPds,
  isPdsRecordNotFound,
  handlePdsError,
} from '../services/pds-writer.js';
import { createAuthMiddleware, getAuthContext } from '../middleware/auth.js';
import { fetchProfilesFromBluesky } from '../services/profile-resolver.js';

const followSchema = z.object({
  subjectDid: z.string().startsWith('did:'),
});

export function registerFollowRoutes(
  app: FastifyInstance,
  db: Database,
  oauthClient: NodeOAuthClient | null,
) {
  const requireAuth = createAuthMiddleware(oauthClient, db);

  // POST /api/follow -- create a follow relationship
  app.post('/api/follow', { preHandler: requireAuth }, async (request, reply) => {
    const body = followSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'InvalidRequest', issues: body.error.issues });
    }

    const { did, session } = getAuthContext(request);

    if (did === body.data.subjectDid) {
      return reply.status(400).send({ error: 'InvalidRequest', message: 'Cannot follow yourself' });
    }

    const rkey = generateTid();

    // Write to user's PDS
    await writeToUserPds(session, did, [
      buildApplyWritesOp('create', 'id.sifa.graph.follow', rkey, {
        subject: body.data.subjectDid,
        createdAt: new Date().toISOString(),
      }),
    ]);

    // Optimistically insert into connections table (with rkey)
    await db
      .insert(connections)
      .values({
        followerDid: did,
        subjectDid: body.data.subjectDid,
        source: 'sifa',
        rkey,
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    return reply.status(201).send({ rkey });
  });

  // DELETE /api/follow/:did -- remove a follow relationship
  app.delete<{ Params: { did: string } }>(
    '/api/follow/:did',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { did: followerDid, session } = getAuthContext(request);
      const { did: subjectDid } = request.params;

      // Look up the rkey from the connections table
      const [row] = await db
        .select({ rkey: connections.rkey })
        .from(connections)
        .where(
          and(
            eq(connections.followerDid, followerDid),
            eq(connections.subjectDid, subjectDid),
            eq(connections.source, 'sifa'),
          ),
        )
        .limit(1);

      // Delete PDS record if we have the rkey
      if (row?.rkey) {
        try {
          await writeToUserPds(session, followerDid, [
            buildApplyWritesOp('delete', 'id.sifa.graph.follow', row.rkey),
          ]);
        } catch (err) {
          if (!isPdsRecordNotFound(err)) {
            return handlePdsError(err, reply);
          }
        }
      }

      // Remove from connections table
      await db
        .delete(connections)
        .where(
          and(
            eq(connections.followerDid, followerDid),
            eq(connections.subjectDid, subjectDid),
            eq(connections.source, 'sifa'),
          ),
        );

      return reply.status(200).send({ status: 'ok' });
    },
  );

  // GET /api/following -- list everyone the authenticated user follows
  app.get('/api/following', { preHandler: requireAuth }, async (request, reply) => {
    const { did } = getAuthContext(request);
    const query = request.query as {
      source?: string;
      cursor?: string;
      limit?: string;
    };

    const source = query.source;
    const limit = Math.min(parseInt(query.limit ?? '20', 10) || 20, 50);

    const conditions = [eq(connections.followerDid, did)];
    if (source) {
      conditions.push(eq(connections.source, source));
    }
    if (query.cursor) {
      conditions.push(lt(connections.createdAt, new Date(query.cursor)));
    }

    const rows = await db
      .select({
        subjectDid: connections.subjectDid,
        source: connections.source,
        createdAt: connections.createdAt,
        handle: profiles.handle,
        displayName: profiles.displayName,
        headline: profiles.headline,
        avatarUrl: profiles.avatarUrl,
      })
      .from(connections)
      .leftJoin(profiles, eq(connections.subjectDid, profiles.did))
      .where(and(...conditions))
      .orderBy(sql`${connections.createdAt} DESC`)
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    // Enrich rows without profile data from Bluesky
    const needEnrich = items.filter((r) => !r.handle).map((r) => r.subjectDid);
    const enriched =
      needEnrich.length > 0 ? await fetchProfilesFromBluesky(needEnrich, app.log) : [];
    const enrichedMap = new Map(enriched.map((p) => [p.did, p]));

    const follows = items.map((r) => {
      const bsky = enrichedMap.get(r.subjectDid);
      const claimed = r.handle !== null;
      return {
        did: r.subjectDid,
        handle: r.handle || bsky?.handle || '',
        displayName: r.displayName ?? bsky?.displayName,
        headline: r.headline ?? undefined,
        avatar: r.avatarUrl ?? bsky?.avatarUrl,
        source: r.source,
        claimed,
        followedAt: r.createdAt.toISOString(),
      };
    });

    return reply.send({
      follows,
      cursor: hasMore ? items[items.length - 1]?.createdAt?.toISOString() : undefined,
    });
  });
}
