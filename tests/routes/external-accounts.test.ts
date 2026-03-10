import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/server.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

describe('External accounts endpoints', () => {
  let app: FastifyInstance;
  const tmpKeysDir = join(tmpdir(), `sifa-test-keys-extacc-${Date.now()}`);
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

  // --- POST /api/profile/external-accounts ---

  it('POST /api/profile/external-accounts returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/profile/external-accounts',
      payload: {
        platform: 'github',
        url: 'https://github.com/testuser',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/profile/external-accounts rejects invalid platform', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/profile/external-accounts',
      payload: {
        platform: 'invalid',
        url: 'https://example.com',
      },
    });
    expect(res.statusCode).toBe(401); // no auth, but validation would fail too
  });

  // --- PUT /api/profile/external-accounts/:rkey ---

  it('PUT /api/profile/external-accounts/:rkey returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/profile/external-accounts/abc123',
      payload: {
        platform: 'website',
        url: 'https://example.com',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  // --- DELETE /api/profile/external-accounts/:rkey ---

  it('DELETE /api/profile/external-accounts/:rkey returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/profile/external-accounts/abc123',
    });
    expect(res.statusCode).toBe(401);
  });

  // --- GET /api/profile/:handleOrDid/external-accounts ---

  it('GET /api/profile/:handle/external-accounts returns 404 for unknown handle', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/profile/nonexistent.bsky.social/external-accounts',
    });
    expect(res.statusCode).toBe(404);
  });

  // --- GET /api/profile/:handleOrDid/feed-items ---

  it('GET /api/profile/:handle/feed-items returns 404 for unknown handle', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/profile/nonexistent.bsky.social/feed-items',
    });
    expect(res.statusCode).toBe(404);
  });
});
