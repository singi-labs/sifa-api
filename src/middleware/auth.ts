import type { FastifyRequest, FastifyReply } from 'fastify';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import type { OAuthSession } from '@atproto/oauth-client';
import { eq, and, gt, sql } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { sessions, profiles } from '../db/schema/index.js';
import './types.js';

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
      request.oauthSession = session;
      request.did = session.did;

      // Update lastActiveAt at most once per hour (fire-and-forget)
      const oneHourAgo = new Date(Date.now() - 3600_000);
      db.update(profiles)
        .set({ lastActiveAt: new Date() })
        .where(
          sql`${profiles.did} = ${did} AND (${profiles.lastActiveAt} IS NULL OR ${profiles.lastActiveAt} < ${oneHourAgo})`,
        )
        .then(() => {})
        .catch(() => {});
    } catch {
      reply.clearCookie('session', { path: '/' });
      return reply.status(401).send({ error: 'SessionExpired', message: 'Please sign in again' });
    }
  };
}

/**
 * Extracts the authenticated DID and OAuth session from the request.
 * Only safe to call in routes guarded by requireAuth middleware.
 */
export function getAuthContext(request: FastifyRequest): { did: string; session: OAuthSession } {
  const { did, oauthSession } = request;
  if (!did || !oauthSession) {
    throw new Error('getAuthContext called without auth middleware');
  }
  return { did, session: oauthSession };
}
