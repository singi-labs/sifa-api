import type { NodeSavedSession, NodeSavedSessionStore } from '@atproto/oauth-client-node';
import type { Database } from '../db/index.js';
import { oauthSessions } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

/**
 * Database-backed session store for ATproto OAuth.
 * Implements the SimpleStore<string, NodeSavedSession> interface required by NodeOAuthClient.
 *
 * Sessions are persisted in the oauth_sessions PostgreSQL table so they survive
 * server restarts. The token_set column stores the full NodeSavedSession value
 * as JSONB.
 */
export class DbSessionStore implements NodeSavedSessionStore {
  constructor(private db: Database) {}

  async get(key: string): Promise<NodeSavedSession | undefined> {
    const rows = await this.db
      .select()
      .from(oauthSessions)
      .where(eq(oauthSessions.sessionId, key))
      .limit(1);

    if (rows.length === 0) return undefined;
    const row = rows[0];
    if (!row) return undefined;
    return row.tokenSet as unknown as NodeSavedSession;
  }

  async set(key: string, val: NodeSavedSession): Promise<void> {
    // NodeSavedSession is ToDpopJwkValue<Session>, which includes dpopJwk as a
    // serialisable JWK object. We store the entire value in token_set JSONB and
    // extract metadata fields for queryability. Casts are needed because the
    // exact shape of NodeSavedSession varies across @atproto/oauth-client-node
    // versions and the Drizzle jsonb column type is `unknown`.
    const session = val as Record<string, unknown>;

    await this.db
      .insert(oauthSessions)
      .values({
        sessionId: key,
        did: (session.did as string) ?? '',
        handle: (session.handle as string) ?? '',
        pdsUrl: (session.pdsUrl as string) ?? '',
        tokenSet: val as unknown as Record<string, unknown>,
        dpopKey: (session.dpopJwk as Record<string, unknown>) ?? {},
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days
      })
      .onConflictDoUpdate({
        target: oauthSessions.sessionId,
        set: {
          tokenSet: val as unknown as Record<string, unknown>,
          did: (session.did as string) ?? '',
          handle: (session.handle as string) ?? '',
          pdsUrl: (session.pdsUrl as string) ?? '',
          dpopKey: (session.dpopJwk as Record<string, unknown>) ?? {},
        },
      });
  }

  async del(key: string): Promise<void> {
    await this.db
      .delete(oauthSessions)
      .where(eq(oauthSessions.sessionId, key));
  }
}
