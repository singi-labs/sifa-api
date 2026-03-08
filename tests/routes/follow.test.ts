import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/server.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

describe('Follow routes', () => {
  let app: FastifyInstance;
  const tmpKeysDir = join(tmpdir(), `sifa-test-keys-follow-${Date.now()}`);
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

  // --- POST /api/follow ---

  it('POST /api/follow returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/follow',
      payload: { subjectDid: 'did:plc:other' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Unauthorized');
  });

  // --- DELETE /api/follow/:did ---

  it('DELETE /api/follow/:did returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/follow/did:plc:other',
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Unauthorized');
  });

  // --- Validation: missing subjectDid ---
  // With the centralized auth middleware as preHandler, auth runs first.
  // Since oauthClient is null in test, a session cookie yields 503 before
  // the route handler body (which does validation) is reached.

  it('POST /api/follow returns 503 with session cookie but no OAuth client (even with bad body)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/follow',
      payload: {},
      cookies: { session: 'test-session-id' },
    });
    expect(res.statusCode).toBe(503);
  });

  // --- Validation: cannot follow yourself ---
  // Same as above: auth middleware runs first, returns 503 before route logic.

  it('POST /api/follow returns 503 when following yourself (no OAuth client)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/follow',
      payload: { subjectDid: 'did:plc:myself' },
      cookies: { session: 'test-session-id' },
    });
    expect(res.statusCode).toBe(503);
  });

  // --- OAuth client unavailable (503) ---

  it('POST /api/follow returns 503 with valid input but no OAuth client', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/follow',
      payload: { subjectDid: 'did:plc:other' },
      cookies: { session: 'test-session-id' },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe('ServiceUnavailable');
  });

  it('DELETE /api/follow/:did returns 503 with session but no OAuth client', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/follow/did:plc:other',
      cookies: { session: 'test-session-id' },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe('ServiceUnavailable');
  });
});
