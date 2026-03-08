import type { FastifyRequest, FastifyReply } from 'fastify';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';

export function createAuthMiddleware(oauthClient: NodeOAuthClient) {
  return async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
    const sessionDid = request.cookies.session;
    if (!sessionDid) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
    }

    try {
      const session = await oauthClient.restore(sessionDid);
      (request as any).session = session;
      (request as any).did = session.did;
    } catch {
      reply.clearCookie('session', { path: '/' });
      return reply.status(401).send({ error: 'SessionExpired', message: 'Please sign in again' });
    }
  };
}
