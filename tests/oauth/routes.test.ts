import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/server.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';

describe('OAuth routes', () => {
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
    rmSync('./keys', { recursive: true, force: true });
  });

  it('POST /oauth/login validates handle input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/oauth/login',
      payload: { handle: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /oauth/callback requires code and state params', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/oauth/callback',
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /oauth/logout clears session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/oauth/logout',
    });
    expect([200, 302]).toContain(res.statusCode);
  });

  it('GET /api/auth/session returns 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
    });
    expect(res.statusCode).toBe(401);
  });
});
