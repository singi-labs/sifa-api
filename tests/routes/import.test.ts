import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/server.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

describe('Import routes', () => {
  let app: FastifyInstance;
  const tmpKeysDir = join(tmpdir(), `sifa-test-keys-import-${Date.now()}`);
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

  it('POST /api/import/linkedin/confirm returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/import/linkedin/confirm',
      payload: { positions: [] },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Unauthorized');
  });

  it('POST /api/import/linkedin/confirm returns 503 with session cookie but no OAuth client', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/import/linkedin/confirm',
      payload: { positions: [] },
      cookies: { session: 'test-session-id' },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe('ServiceUnavailable');
  });

  it('POST /api/import/linkedin/confirm accepts valid empty payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/import/linkedin/confirm',
      payload: {},
      cookies: { session: 'test-session-id' },
    });
    // 503 because no OAuth client -- but it passed validation
    expect(res.statusCode).toBe(503);
  });

  it('POST /api/import/linkedin/confirm strips invalid credential URLs instead of rejecting', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/import/linkedin/confirm',
      payload: {
        certifications: [
          { name: 'Valid Cert', credentialUrl: 'https://example.com/cert' },
          { name: 'Bad URL Cert', credentialUrl: 'not-a-url' },
          { name: 'Empty URL Cert', credentialUrl: '' },
          { name: 'No URL Cert' },
        ],
        projects: [{ name: 'Proj', url: 'garbage' }],
        publications: [{ title: 'Pub', url: '????' }],
      },
      cookies: { session: 'test-session-id' },
    });
    // 503 because no OAuth client -- but it passed validation (not 400)
    expect(res.statusCode).toBe(503);
  });

  it('POST /api/import/linkedin/confirm accepts valid payload with all sections', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/import/linkedin/confirm',
      payload: {
        profile: { headline: 'Software Engineer', about: 'Building things' },
        positions: [
          { companyName: 'Acme Corp', title: 'Engineer', startDate: '2020-01', current: true },
        ],
        education: [{ institution: 'MIT', degree: 'BSc', fieldOfStudy: 'CS' }],
        skills: [{ skillName: 'TypeScript' }, { skillName: 'Rust' }],
      },
      cookies: { session: 'test-session-id' },
    });
    // 503 because no OAuth client -- but it passed validation
    expect(res.statusCode).toBe(503);
  });
});
