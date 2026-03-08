import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/server.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

describe('Health and .well-known routes', () => {
  let app: FastifyInstance;
  const tmpKeysDir = join(tmpdir(), `sifa-test-keys-health-${Date.now()}`);
  const jwksPath = join(tmpKeysDir, 'jwks.json');
  const testDid = 'did:plc:test-health';

  beforeAll(async () => {
    mkdirSync(tmpKeysDir, { recursive: true });
    writeFileSync(jwksPath, JSON.stringify({ keys: [{ kty: 'EC', crv: 'P-256', kid: 'test' }] }));

    app = await buildServer({
      NODE_ENV: 'test',
      PORT: 0,
      PUBLIC_URL: 'http://localhost:3100',
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://sifa:sifa@localhost:5432/sifa',
      VALKEY_URL: 'redis://localhost:6379',
      SIFA_DID: testDid,
      JETSTREAM_URL: 'wss://jetstream1.us-east.bsky.network/subscribe',
      OAUTH_JWKS_PATH: jwksPath,
    });
  });

  afterAll(async () => {
    await app.close();
    rmSync(tmpKeysDir, { recursive: true, force: true });
  });

  it('GET /api/health returns 200 with { status: "ok" }', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('GET /api/health/ready returns 200 with component statuses', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health/ready' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.components).toBeDefined();
    expect(body.components.postgresql).toEqual({ status: 'ok' });
    // Valkey is null in test mode, so it should be skipped
    expect(body.components.valkey).toEqual({ status: 'skipped' });
  });

  it('GET /.well-known/atproto-did returns DID as text/plain', async () => {
    const res = await app.inject({ method: 'GET', url: '/.well-known/atproto-did' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.body).toBe(testDid);
  });
});
