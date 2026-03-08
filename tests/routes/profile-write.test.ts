import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/server.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

describe('Profile write endpoints', () => {
  let app: FastifyInstance;
  const tmpKeysDir = join(tmpdir(), `sifa-test-keys-write-${Date.now()}`);
  const jwksPath = join(tmpKeysDir, 'jwks.json');

  beforeAll(async () => {
    mkdirSync(tmpKeysDir, { recursive: true });
    writeFileSync(
      jwksPath,
      JSON.stringify({ keys: [{ kty: 'EC', crv: 'P-256', kid: 'test' }] }),
    );

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

  // --- PUT /api/profile/self ---

  it('PUT /api/profile/self returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/profile/self',
      payload: { headline: 'Test' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Unauthorized');
  });

  // --- POST /api/profile/position ---

  it('POST /api/profile/position returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/profile/position',
      payload: { companyName: 'Acme', title: 'Eng', startDate: '2020-01' },
    });
    expect(res.statusCode).toBe(401);
  });

  // --- PUT /api/profile/position/:rkey ---

  it('PUT /api/profile/position/:rkey returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/profile/position/3abc',
      payload: { companyName: 'Acme', title: 'Eng', startDate: '2020-01' },
    });
    expect(res.statusCode).toBe(401);
  });

  // --- DELETE /api/profile/position/:rkey ---

  it('DELETE /api/profile/position/:rkey returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/profile/position/3abc',
    });
    expect(res.statusCode).toBe(401);
  });

  // --- POST /api/profile/education ---

  it('POST /api/profile/education returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/profile/education',
      payload: { institution: 'MIT' },
    });
    expect(res.statusCode).toBe(401);
  });

  // --- PUT /api/profile/education/:rkey ---

  it('PUT /api/profile/education/:rkey returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/profile/education/3def',
      payload: { institution: 'MIT' },
    });
    expect(res.statusCode).toBe(401);
  });

  // --- DELETE /api/profile/education/:rkey ---

  it('DELETE /api/profile/education/:rkey returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/profile/education/3def',
    });
    expect(res.statusCode).toBe(401);
  });

  // --- POST /api/profile/skill ---

  it('POST /api/profile/skill returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/profile/skill',
      payload: { skillName: 'TypeScript' },
    });
    expect(res.statusCode).toBe(401);
  });

  // --- PUT /api/profile/skill/:rkey ---

  it('PUT /api/profile/skill/:rkey returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/profile/skill/3ghi',
      payload: { skillName: 'TypeScript' },
    });
    expect(res.statusCode).toBe(401);
  });

  // --- DELETE /api/profile/skill/:rkey ---

  it('DELETE /api/profile/skill/:rkey returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/profile/skill/3ghi',
    });
    expect(res.statusCode).toBe(401);
  });

  // --- Validation tests (with session cookie but no OAuth client = 503) ---
  // These verify that validation runs before PDS writes would be attempted.
  // Since oauthClient is null in test mode, a valid session cookie yields 503
  // (proving the auth middleware accepted the cookie and tried the OAuth client).

  it('PUT /api/profile/self returns 503 with session cookie but no OAuth client', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/profile/self',
      payload: { headline: 'Test' },
      cookies: { session: 'test-session-id' },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe('ServiceUnavailable');
  });

  it('POST /api/profile/position returns 503 with session cookie but no OAuth client', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/profile/position',
      payload: { companyName: 'Acme', title: 'Eng', startDate: '2020-01' },
      cookies: { session: 'test-session-id' },
    });
    expect(res.statusCode).toBe(503);
  });
});
