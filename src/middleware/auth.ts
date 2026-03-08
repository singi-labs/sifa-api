import type { FastifyRequest, FastifyReply } from 'fastify';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import { eq, and, gt } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { sessions } from '../db/schema/index.js';

/**
 * Resolves a session cookie value to a DID by looking up the sessions table.
 * Returns undefined if the cookie is missing, the session doesn't exist, or it's expired.
 * Used by routes that optionally read the viewer (e.g., profile read).
 */
export async function resolveSessionDid(
  db: Database,
  sessionId: string | undefined,
): Promise<string | undefined> {
  if (!sessionId) return undefined;

  const [row] = await db
    .select({ did: sessions.did })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
    .limit(1);

  return row?.did;
}

/**
 * Creates an auth middleware that:
 * 1. Reads the session cookie (an opaque session ID, not a DID)
 * 2. Looks up the session in the database to get the DID
 * 3. Restores the OAuth session via the NodeOAuthClient
 * 4. Attaches `request.did` and `request.session` for downstream handlers
 */
export function createAuthMiddleware(oauthClient: NodeOAuthClient | null, db: Database) {
  return async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
    const sessionId = request.cookies?.session;
    if (!sessionId) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
    }

    if (!oauthClient) {
      return reply
        .status(503)
        .send({ error: 'ServiceUnavailable', message: 'OAuth client not available' });
    }

    // Look up session by cookie value from sessions table
    const did = await resolveSessionDid(db, sessionId);
    if (!did) {
      reply.clearCookie('session', { path: '/' });
      return reply.status(401).send({ error: 'SessionExpired', message: 'Please sign in again' });
    }

    try {
      const session = await oauthClient.restore(did);
      (request as any).session = session;
      (request as any).did = session.did;
    } catch {
      reply.clearCookie('session', { path: '/' });
      return reply.status(401).send({ error: 'SessionExpired', message: 'Please sign in again' });
    }
  };
}
