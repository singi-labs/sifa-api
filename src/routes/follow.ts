import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import type { Database } from '../db/index.js';
import { connections } from '../db/schema/index.js';
import { and, eq } from 'drizzle-orm';
import { generateTid, buildApplyWritesOp, writeToUserPds } from '../services/pds-writer.js';

const followSchema = z.object({
  subjectDid: z.string().startsWith('did:'),
});

export function registerFollowRoutes(
  app: FastifyInstance,
  db: Database,
  oauthClient: NodeOAuthClient | null,
) {
  // POST /api/follow -- create a follow relationship
  app.post('/api/follow', async (request, reply) => {
    const sessionDid = request.cookies?.session;
    if (!sessionDid) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const body = followSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'InvalidRequest', issues: body.error.issues });
    }

    if (sessionDid === body.data.subjectDid) {
      return reply.status(400).send({ error: 'InvalidRequest', message: 'Cannot follow yourself' });
    }

    if (!oauthClient) {
      return reply.status(503).send({ error: 'Unavailable', message: 'OAuth client not available' });
    }

    const rkey = generateTid();

    // Write to user's PDS
    const session = await oauthClient.restore(sessionDid);
    await writeToUserPds(session, sessionDid, [
      buildApplyWritesOp('create', 'id.sifa.graph.follow', rkey, {
        subject: body.data.subjectDid,
        createdAt: new Date().toISOString(),
      }),
    ]);

    // Optimistically insert into connections table
    await db.insert(connections).values({
      followerDid: sessionDid,
      subjectDid: body.data.subjectDid,
      source: 'sifa',
      createdAt: new Date(),
    }).onConflictDoNothing();

    return reply.status(201).send({ rkey });
  });

  // DELETE /api/follow/:did -- remove a follow relationship
  app.delete<{ Params: { did: string } }>('/api/follow/:did', async (request, reply) => {
    const sessionDid = request.cookies?.session;
    if (!sessionDid) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
    }

    if (!oauthClient) {
      return reply.status(503).send({ error: 'Unavailable', message: 'OAuth client not available' });
    }

    const { did: subjectDid } = request.params;

    // Remove from connections table
    // The PDS record will be cleaned up by Jetstream indexer
    await db.delete(connections).where(
      and(
        eq(connections.followerDid, sessionDid),
        eq(connections.subjectDid, subjectDid),
        eq(connections.source, 'sifa'),
      ),
    );

    return reply.status(200).send({ status: 'ok' });
  });
}
