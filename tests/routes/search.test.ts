import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/server.js';
import { createDb } from '../../src/db/index.js';
import { profiles } from '../../src/db/schema/index.js';
import { sql } from 'drizzle-orm';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

describe('Search API', () => {
  let app: FastifyInstance;
  const db = createDb(process.env.DATABASE_URL ?? 'postgresql://sifa:sifa@localhost:5432/sifa');
  const tmpKeysDir = join(tmpdir(), `sifa-test-keys-search-${Date.now()}`);
  const jwksPath = join(tmpKeysDir, 'jwks.json');

  beforeAll(async () => {
    mkdirSync(tmpKeysDir, { recursive: true });
    writeFileSync(jwksPath, JSON.stringify({ keys: [{ kty: 'EC', crv: 'P-256', kid: 'test' }] }));

    await db
      .insert(profiles)
      .values({
        did: 'did:plc:search-test',
        handle: 'searchtest.bsky.social',
        headline: 'Senior TypeScript Developer',
        about: 'Building distributed systems',
        createdAt: new Date(),
      })
      .onConflictDoNothing();

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
    await db.execute(sql`DELETE FROM profiles WHERE did = 'did:plc:search-test'`);
    await db.$client.end();
    await app.close();
    rmSync(tmpKeysDir, { recursive: true });
  });

  it('GET /api/search/profiles returns matching results', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search/profiles?q=TypeScript' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.profiles.length).toBeGreaterThanOrEqual(1);
    expect(body.profiles.some((p: { did: string }) => p.did === 'did:plc:search-test')).toBe(true);
  });

  it('GET /api/search/profiles returns 400 without query', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search/profiles' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('InvalidRequest');
  });

  it('GET /api/search/profiles returns empty for no matches', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/search/profiles?q=xyznonexistent999',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().profiles).toHaveLength(0);
  });

  it('GET /api/search/profiles respects limit parameter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/search/profiles?q=TypeScript&limit=1',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().profiles.length).toBeLessThanOrEqual(1);
  });

  it('GET /api/search/profiles returns 400 for empty query string', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search/profiles?q=' });
    expect(res.statusCode).toBe(400);
  });
});
