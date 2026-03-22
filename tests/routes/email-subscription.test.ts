import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/server.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

describe('Email subscription routes', () => {
  let app: FastifyInstance;
  const tmpKeysDir = join(tmpdir(), `sifa-test-keys-email-sub-${Date.now()}`);
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

  it('POST /api/email-subscription returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/email-subscription',
      payload: { email: 'test@example.com' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Unauthorized');
  });

  it('POST /api/email-subscription route exists (returns 401/400/503, not 404)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/email-subscription',
      payload: { email: 'test@example.com' },
    });
    expect(res.statusCode).not.toBe(404);
  });

  it('POST /api/email-subscription returns 503 with session cookie but no OAuth client', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/email-subscription',
      payload: { email: 'test@example.com' },
      cookies: { session: 'test-session-id' },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe('ServiceUnavailable');
  });
});
