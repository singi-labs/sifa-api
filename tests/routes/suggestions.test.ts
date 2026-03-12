import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/server.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

describe('Suggestions routes', () => {
  let app: FastifyInstance;
  const tmpKeysDir = join(tmpdir(), `sifa-test-keys-suggestions-${Date.now()}`);
  const jwksPath = join(tmpKeysDir, 'jwks.json');

  beforeAll(async () => {
    mkdirSync(tmpKeysDir, { recursive: true });
    writeFileSync(jwksPath, JSON.stringify({ keys: [{ kty: 'EC', crv: 'P-256', kid: 'test' }] }));

    app = await buildServer({
      NODE_ENV: 'test',
      PORT: 0,
      PUBLIC_URL: 'http://localhost:3100',
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://sifa:sifa@localhost:5432/sifa',
      VALKEY_URL: 'redis://localhost:6379',
      SIFA_DID: 'did:plc:test',
      JETSTREAM_URL: 'wss://jetstream1.us-east.bsky.network/subscribe',
      OAUTH_JWKS_PATH: jwksPath,
    });
  });

  afterAll(async () => {
    await app.close();
    rmSync(tmpKeysDir, { recursive: true });
  });

  // --- GET /api/suggestions ---

  it('GET /api/suggestions returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/suggestions',
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/suggestions returns 503 with session but no OAuth client', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/suggestions',
      cookies: { session: 'test-session-id' },
    });
    expect(res.statusCode).toBe(503);
  });

  // --- GET /api/suggestions/count ---

  it('GET /api/suggestions/count returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/suggestions/count',
    });
    expect(res.statusCode).toBe(401);
  });

  // --- POST /api/suggestions/dismiss ---

  it('POST /api/suggestions/dismiss returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/suggestions/dismiss',
      payload: { subjectDid: 'did:plc:other' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/suggestions/dismiss returns 503 with session but no OAuth client', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/suggestions/dismiss',
      payload: {},
      cookies: { session: 'test-session-id' },
    });
    // Auth middleware runs first, returns 503 before validation
    expect(res.statusCode).toBe(503);
  });

  // --- DELETE /api/suggestions/dismiss/:did ---

  it('DELETE /api/suggestions/dismiss/:did returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/suggestions/dismiss/did:plc:other',
    });
    expect(res.statusCode).toBe(401);
  });

  // --- POST /api/invites ---

  it('POST /api/invites returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/invites',
      payload: { subjectDid: 'did:plc:other' },
    });
    expect(res.statusCode).toBe(401);
  });
});
