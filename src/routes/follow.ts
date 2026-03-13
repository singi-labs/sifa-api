import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import type { Database } from '../db/index.js';
import { connections } from '../db/schema/index.js';
import { and, eq } from 'drizzle-orm';
import {
  generateTid,
  buildApplyWritesOp,
  writeToUserPds,
  isPdsRecordNotFound,
  handlePdsError,
} from '../services/pds-writer.js';
import { createAuthMiddleware, getAuthContext } from '../middleware/auth.js';

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
}
