import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/server.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';

describe('OAuth metadata endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    mkdirSync('./keys', { recursive: true });
    writeFileSync(
      './keys/jwks.json',
      JSON.stringify({ keys: [{ kty: 'EC', crv: 'P-256', kid: 'test' }] }),
    );
    app = await buildServer({
      NODE_ENV: 'test',
      PORT: 0,
      PUBLIC_URL: 'https://sifa.id',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      VALKEY_URL: 'redis://localhost:6379',
      SIFA_DID: 'did:plc:test',
      JETSTREAM_URL: 'wss://jetstream1.us-east.bsky.network/subscribe',
      OAUTH_JWKS_PATH: './keys/jwks.json',
    });
  });

  afterAll(async () => {
    await app.close();
    rmSync('./keys', { recursive: true });
  });

  it('GET /oauth/client-metadata.json returns valid metadata', async () => {
    const res = await app.inject({ method: 'GET', url: '/oauth/client-metadata.json' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.client_id).toBe('https://sifa.id/oauth/client-metadata.json');
    expect(body.dpop_bound_access_tokens).toBe(true);
    expect(body.redirect_uris).toContain('https://sifa.id/oauth/callback');
  });

  it('GET /oauth/jwks.json returns JWKS', async () => {
    const res = await app.inject({ method: 'GET', url: '/oauth/jwks.json' });
    expect(res.statusCode).toBe(200);
    expect(res.json().keys).toBeDefined();
  });
});
