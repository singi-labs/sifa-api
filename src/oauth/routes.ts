import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';

const loginSchema = z.object({
  handle: z.string().min(1).max(253),
});

export function registerOAuthRoutes(app: FastifyInstance, oauthClient: NodeOAuthClient | null) {
  // Login: initiate OAuth flow
  app.post('/oauth/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'InvalidRequest', message: 'Handle is required' });
    }

    if (!oauthClient) {
      return reply.status(503).send({ error: 'Unavailable', message: 'OAuth not configured' });
    }

    const url = await oauthClient.authorize(body.data.handle, {
      scope: 'atproto transition:generic',
    });

    return reply.send({ redirectUrl: url.toString() });
  });

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

    // Set session cookie
    reply.setCookie('session', did, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 180 * 24 * 60 * 60, // 180 days
    });

    return reply.redirect('/');
  });

  // Logout
  app.post('/oauth/logout', async (_request, reply) => {
    reply.clearCookie('session', { path: '/' });
    return reply.send({ status: 'ok' });
  });

  // Session info
  app.get('/api/auth/session', async (request, reply) => {
    const sessionDid = request.cookies.session;
    if (!sessionDid) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    if (!oauthClient) {
      return reply.status(503).send({ error: 'Unavailable' });
    }

    try {
      const session = await oauthClient.restore(sessionDid);
      return reply.send({
        did: session.did,
        handle: session.handle,
      });
    } catch {
      reply.clearCookie('session', { path: '/' });
      return reply.status(401).send({ error: 'SessionExpired' });
    }
  });
}
