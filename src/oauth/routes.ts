import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { eq, and, gt } from 'drizzle-orm';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import type { Database } from '../db/index.js';
import { sessions } from '../db/schema/index.js';

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

      let url: URL;
      try {
        url = await oauthClient.authorize(body.data.handle, {
          scope:
            'atproto repo:id.sifa.profile.* repo:id.sifa.graph.follow repo:id.sifa.endorsement',
        });
      } catch {
        // PDS may not support granular scopes — fall back to transition:generic
        url = await oauthClient.authorize(body.data.handle, {
          scope: 'atproto transition:generic',
        });
      }

      return reply.send({ redirectUrl: url.toString() });
    },
  );

  // Callback: exchange code for tokens
  app.get('/oauth/callback', async (request, reply) => {
    const params = new URLSearchParams(request.url.split('?')[1] ?? '');
    if (!params.get('code') || !params.get('state')) {
      return reply.status(400).send({ error: 'InvalidRequest', message: 'Missing code or state' });
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

    return reply.redirect('/');
  });

  // Logout
  app.post('/oauth/logout', async (request, reply) => {
    const sessionId = request.cookies?.session;
    if (sessionId) {
      await db.delete(sessions).where(eq(sessions.id, sessionId));
    }
    reply.clearCookie('session', { path: '/' });
    return reply.send({ status: 'ok' });
  });

  // Session info
  app.get('/api/auth/session', async (request, reply) => {
    const sessionId = request.cookies?.session;
    if (!sessionId) {
      return reply.status(401).send({ error: 'Unauthorized' });
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
      const session = await oauthClient.restore(row.did);
      return reply.send({
        did: session.did,
      });
    } catch {
      reply.clearCookie('session', { path: '/' });
      return reply.status(401).send({ error: 'SessionExpired' });
    }
  });
}
