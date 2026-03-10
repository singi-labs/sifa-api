import type { FastifyInstance } from 'fastify';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import type { Database } from '../db/index.js';
import { profileSelfSchema, positionSchema, educationSchema, skillSchema } from './schemas.js';
import { generateTid, buildApplyWritesOp, writeToUserPds } from '../services/pds-writer.js';
import { createAuthMiddleware, getAuthContext } from '../middleware/auth.js';

export function registerProfileWriteRoutes(
  app: FastifyInstance,
  db: Database,
  oauthClient: NodeOAuthClient | null,
) {
  const requireAuth = createAuthMiddleware(oauthClient, db);

  // PUT /api/profile/self -- update the user's profile summary
  app.put('/api/profile/self', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = profileSelfSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationError', issues: parsed.error.issues });
    }

    const { did, session } = getAuthContext(request);
    const record: Record<string, unknown> = {
      createdAt: new Date().toISOString(),
      ...parsed.data,
    };

    // Flatten location for the ATproto record
    if (parsed.data.location) {
      record.location = parsed.data.location;
    }

    await writeToUserPds(session, did, [
      buildApplyWritesOp('update', 'id.sifa.profile.self', 'self', record),
    ]);

    return reply.status(200).send({ ok: true });
  });

  // POST /api/profile/position -- create a new position
  app.post('/api/profile/position', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = positionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationError', issues: parsed.error.issues });
    }

    const { did, session } = getAuthContext(request);
    const rkey = generateTid();
    const record: Record<string, unknown> = {
      createdAt: new Date().toISOString(),
      ...parsed.data,
    };

    await writeToUserPds(session, did, [
      buildApplyWritesOp('create', 'id.sifa.profile.position', rkey, record),
    ]);

    return reply.status(201).send({ rkey });
  });

  // PUT /api/profile/position/:rkey -- update an existing position
  app.put<{ Params: { rkey: string } }>(
    '/api/profile/position/:rkey',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = positionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'ValidationError', issues: parsed.error.issues });
      }

      const { did, session } = getAuthContext(request);
      const { rkey } = request.params;
      const record: Record<string, unknown> = {
        createdAt: new Date().toISOString(),
        ...parsed.data,
      };

      await writeToUserPds(session, did, [
        buildApplyWritesOp('update', 'id.sifa.profile.position', rkey, record),
      ]);

      return reply.status(200).send({ ok: true });
    },
  );

  // DELETE /api/profile/position/:rkey -- delete a position
  app.delete<{ Params: { rkey: string } }>(
    '/api/profile/position/:rkey',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { did, session } = getAuthContext(request);
      const { rkey } = request.params;

      await writeToUserPds(session, did, [
        buildApplyWritesOp('delete', 'id.sifa.profile.position', rkey),
      ]);

      return reply.status(200).send({ ok: true });
    },
  );

  // POST /api/profile/education -- create a new education entry
  app.post('/api/profile/education', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = educationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationError', issues: parsed.error.issues });
    }

    const { did, session } = getAuthContext(request);
    const rkey = generateTid();
    const record: Record<string, unknown> = {
      createdAt: new Date().toISOString(),
      ...parsed.data,
    };

    await writeToUserPds(session, did, [
      buildApplyWritesOp('create', 'id.sifa.profile.education', rkey, record),
    ]);

    return reply.status(201).send({ rkey });
  });

  // PUT /api/profile/education/:rkey -- update an existing education entry
  app.put<{ Params: { rkey: string } }>(
    '/api/profile/education/:rkey',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = educationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'ValidationError', issues: parsed.error.issues });
      }

      const { did, session } = getAuthContext(request);
      const { rkey } = request.params;
      const record: Record<string, unknown> = {
        createdAt: new Date().toISOString(),
        ...parsed.data,
      };

      await writeToUserPds(session, did, [
        buildApplyWritesOp('update', 'id.sifa.profile.education', rkey, record),
      ]);

      return reply.status(200).send({ ok: true });
    },
  );

  // DELETE /api/profile/education/:rkey -- delete an education entry
  app.delete<{ Params: { rkey: string } }>(
    '/api/profile/education/:rkey',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { did, session } = getAuthContext(request);
      const { rkey } = request.params;

      await writeToUserPds(session, did, [
        buildApplyWritesOp('delete', 'id.sifa.profile.education', rkey),
      ]);

      return reply.status(200).send({ ok: true });
    },
  );

  // POST /api/profile/skill -- create a new skill
  app.post('/api/profile/skill', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = skillSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationError', issues: parsed.error.issues });
    }

    const { did, session } = getAuthContext(request);
    const rkey = generateTid();
    const record: Record<string, unknown> = {
      createdAt: new Date().toISOString(),
      ...parsed.data,
    };

    await writeToUserPds(session, did, [
      buildApplyWritesOp('create', 'id.sifa.profile.skill', rkey, record),
    ]);

    return reply.status(201).send({ rkey });
  });

  // PUT /api/profile/skill/:rkey -- update an existing skill
  app.put<{ Params: { rkey: string } }>(
    '/api/profile/skill/:rkey',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = skillSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'ValidationError', issues: parsed.error.issues });
      }

      const { did, session } = getAuthContext(request);
      const { rkey } = request.params;
      const record: Record<string, unknown> = {
        createdAt: new Date().toISOString(),
        ...parsed.data,
      };

      await writeToUserPds(session, did, [
        buildApplyWritesOp('update', 'id.sifa.profile.skill', rkey, record),
      ]);

      return reply.status(200).send({ ok: true });
    },
  );

  // DELETE /api/profile/skill/:rkey -- delete a skill
  app.delete<{ Params: { rkey: string } }>(
    '/api/profile/skill/:rkey',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { did, session } = getAuthContext(request);
      const { rkey } = request.params;

      await writeToUserPds(session, did, [
        buildApplyWritesOp('delete', 'id.sifa.profile.skill', rkey),
      ]);

      return reply.status(200).send({ ok: true });
    },
  );
}
