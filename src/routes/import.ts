import type { FastifyInstance } from 'fastify';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import { z } from 'zod';
import { profileSelfSchema, positionSchema, educationSchema, skillSchema } from './schemas.js';
import { generateTid, buildApplyWritesOp, writeToUserPds } from '../services/pds-writer.js';
import { createAuthMiddleware } from '../middleware/auth.js';

const importPayloadSchema = z.object({
  profile: profileSelfSchema.optional(),
  positions: z.array(positionSchema).max(100).default([]),
  education: z.array(educationSchema).max(50).default([]),
  skills: z.array(skillSchema).max(200).default([]),
});

export function registerImportRoutes(
  app: FastifyInstance,
  oauthClient: NodeOAuthClient | null,
) {
  // Auth preHandler: returns 401 if no session cookie, 503 if no OAuth client
  const requireAuth = async (request: any, reply: any) => {
    const sessionDid = request.cookies?.session;
    if (!sessionDid) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
    }

    if (!oauthClient) {
      return reply
        .status(503)
        .send({ error: 'ServiceUnavailable', message: 'OAuth client not available' });
    }

    const middleware = createAuthMiddleware(oauthClient);
    return middleware(request, reply);
  };

  app.post(
    '/api/import/linkedin/confirm',
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = importPayloadSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: 'InvalidRequest', issues: body.error.issues });
      }

      const { profile, positions, education, skills } = body.data;
      const did = (request as any).did as string;
      const session = (request as any).session;

      // Build write operations
      const writes: ReturnType<typeof buildApplyWritesOp>[] = [];

      if (profile) {
        writes.push(
          buildApplyWritesOp('create', 'id.sifa.profile.self', 'self', {
            ...profile,
            createdAt: new Date().toISOString(),
          }),
        );
      }

      for (const pos of positions) {
        writes.push(
          buildApplyWritesOp('create', 'id.sifa.profile.position', generateTid(), {
            ...pos,
            createdAt: new Date().toISOString(),
          }),
        );
      }

      for (const edu of education) {
        writes.push(
          buildApplyWritesOp('create', 'id.sifa.profile.education', generateTid(), {
            ...edu,
            createdAt: new Date().toISOString(),
          }),
        );
      }

      for (const skill of skills) {
        writes.push(
          buildApplyWritesOp('create', 'id.sifa.profile.skill', generateTid(), {
            ...skill,
            createdAt: new Date().toISOString(),
          }),
        );
      }

      // Batch into chunks of 100 (applyWrites limit)
      const BATCH_SIZE = 100;
      try {
        for (let i = 0; i < writes.length; i += BATCH_SIZE) {
          const batch = writes.slice(i, i + BATCH_SIZE);
          await writeToUserPds(session, did, batch);
        }
      } catch (_err) {
        return reply
          .status(500)
          .send({ error: 'ImportFailed', message: 'Failed to write to PDS' });
      }

      return reply.status(200).send({
        imported: {
          profile: profile ? 1 : 0,
          positions: positions.length,
          education: education.length,
          skills: skills.length,
        },
      });
    },
  );
}
