import type { FastifyInstance } from 'fastify';
import { readFileSync, existsSync } from 'node:fs';
import type { Env } from '../config.js';

export function registerOAuthMetadata(app: FastifyInstance, config: Env) {
  if (config.NODE_ENV !== 'test' && !existsSync(config.OAUTH_JWKS_PATH)) {
    throw new Error(`JWKS file not found at ${config.OAUTH_JWKS_PATH} — OAuth metadata cannot be registered`);
  }
  if (!existsSync(config.OAUTH_JWKS_PATH)) {
    return;
  }

  const jwks = JSON.parse(readFileSync(config.OAUTH_JWKS_PATH, 'utf-8')) as Record<string, unknown>;

  app.get('/oauth/client-metadata.json', async () => ({
    client_id: `${config.PUBLIC_URL}/oauth/client-metadata.json`,
    client_name: 'Sifa',
    client_uri: config.PUBLIC_URL,
    response_types: ['code'],
    grant_types: ['authorization_code', 'refresh_token'],
    scope: [
      'atproto',
      'repo:id.sifa.profile.self',
      'repo:id.sifa.profile.position',
      'repo:id.sifa.profile.education',
      'repo:id.sifa.profile.skill',
      'repo:id.sifa.profile.certification',
      'repo:id.sifa.profile.project',
      'repo:id.sifa.profile.volunteering',
      'repo:id.sifa.profile.publication',
      'repo:id.sifa.profile.course',
      'repo:id.sifa.profile.honor',
      'repo:id.sifa.profile.language',
      'repo:id.sifa.profile.externalAccount',
      'repo:id.sifa.graph.follow',
    ].join(' '),
    redirect_uris: [`${config.PUBLIC_URL}/oauth/callback`],
    dpop_bound_access_tokens: true,
    token_endpoint_auth_method: 'private_key_jwt',
    token_endpoint_auth_signing_alg: 'ES256',
    jwks_uri: `${config.PUBLIC_URL}/oauth/jwks.json`,
  }));

  app.get('/oauth/jwks.json', async () => jwks);
}
