import { JoseKey, NodeOAuthClient } from '@atproto/oauth-client-node';
import type { Env } from '../config.js';
import type { Database } from '../db/index.js';
import { DbSessionStore } from './session-store.js';
import { ValkeyStateStore, type ValkeyClient } from './state-store.js';
import { loadPrivateKey } from './keys.js';

/**
 * Creates and configures the ATproto NodeOAuthClient with:
 * - Database-backed session persistence (PostgreSQL via Drizzle)
 * - Valkey-backed ephemeral state storage (10 min TTL)
 * - Client metadata matching the /oauth/client-metadata.json endpoint
 *
 * The private key is loaded from disk (path derived from OAUTH_JWKS_PATH by
 * replacing "jwks" with "private-key"). This key is used for private_key_jwt
 * token endpoint authentication and DPoP proof signing.
 *
 * Async because JoseKey.fromJWK() needs to import the key material.
 */
export async function createOAuthClient(
  config: Env,
  db: Database,
  valkey: ValkeyClient,
): Promise<NodeOAuthClient> {
  const privateKeyPath = config.OAUTH_JWKS_PATH.replace('jwks', 'private-key');
  const privateKeyJwk = loadPrivateKey(privateKeyPath);
  const key = await JoseKey.fromJWK(privateKeyJwk as Record<string, unknown>);

  return new NodeOAuthClient({
    clientMetadata: {
      client_id: `${config.PUBLIC_URL}/oauth/client-metadata.json`,
      client_name: 'Sifa',
      client_uri: config.PUBLIC_URL,
      response_types: ['code'],
      grant_types: ['authorization_code', 'refresh_token'],
      scope: 'atproto transition:generic',
      redirect_uris: [`${config.PUBLIC_URL}/oauth/callback`],
      dpop_bound_access_tokens: true,
      token_endpoint_auth_method: 'private_key_jwt',
      token_endpoint_auth_signing_alg: 'ES256',
      jwks_uri: `${config.PUBLIC_URL}/oauth/jwks.json`,
    },
    keyset: [key],
    stateStore: new ValkeyStateStore(valkey),
    sessionStore: new DbSessionStore(db),
  });
}
