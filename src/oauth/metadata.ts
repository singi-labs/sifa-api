import type { FastifyInstance } from 'fastify';
import { readFileSync, existsSync } from 'node:fs';
import type { Env } from '../config.js';

export function registerOAuthMetadata(app: FastifyInstance, config: Env) {
  if (!existsSync(config.OAUTH_JWKS_PATH)) {
    app.log.warn(
      `JWKS file not found at ${config.OAUTH_JWKS_PATH}, skipping OAuth metadata registration`,
    );
    return;
  }

  const jwks = JSON.parse(readFileSync(config.OAUTH_JWKS_PATH, 'utf-8')) as Record<string, unknown>;

  app.get('/oauth/client-metadata.json', async () => ({
    client_id: `${config.PUBLIC_URL}/oauth/client-metadata.json`,
    client_name: 'Sifa',
    client_uri: config.PUBLIC_URL,
    response_types: ['code'],
    grant_types: ['authorization_code', 'refresh_token'],
    scope: 'atproto transition:generic',
    redirect_uris: [`${config.PUBLIC_URL}/oauth/callback`],
    dpop_bound_access_tokens: true,
    token_endpoint_auth_method: 'private_key_jwt',
    jwks_uri: `${config.PUBLIC_URL}/oauth/jwks.json`,
  }));

  app.get('/oauth/jwks.json', async () => jwks);
}
