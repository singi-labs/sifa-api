import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDb } from '../../src/db/index.js';
import { profiles, positions, education, skills } from '../../src/db/schema/index.js';
import { sql } from 'drizzle-orm';
import { buildServer } from '../../src/server.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

describe('GET /api/profile/:handleOrDid', () => {
  const db = createDb(process.env.DATABASE_URL ?? 'postgresql://sifa:sifa@localhost:5432/sifa');
  let app: FastifyInstance;
  const tmpKeysDir = join(tmpdir(), `sifa-test-keys-${Date.now()}`);
  const jwksPath = join(tmpKeysDir, 'jwks.json');

  beforeAll(async () => {
    // Create test keys for OAuth metadata in a unique temp directory
    mkdirSync(tmpKeysDir, { recursive: true });
    writeFileSync(jwksPath, JSON.stringify({ keys: [{ kty: 'EC', crv: 'P-256', kid: 'test' }] }));

    // Seed test data
    await db.insert(profiles).values({
      did: 'did:plc:test-profile',
      handle: 'testuser.bsky.social',
      headline: 'Test Engineer',
      about: 'Building tests',
      createdAt: new Date(),
    }).onConflictDoNothing();

    await db.insert(positions).values({
      did: 'did:plc:test-profile',
      rkey: '3abc',
      companyName: 'Test Corp',
      title: 'Engineer',
      startDate: '2020-01',
      current: true,
      createdAt: new Date(),
    }).onConflictDoNothing();

    await db.insert(education).values({
      did: 'did:plc:test-profile',
      rkey: '3def',
      institution: 'Test University',
      degree: 'BSc',
      createdAt: new Date(),
    }).onConflictDoNothing();

    await db.insert(skills).values({
      did: 'did:plc:test-profile',
      rkey: '3ghi',
      skillName: 'TypeScript',
      createdAt: new Date(),
    }).onConflictDoNothing();

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
    await db.execute(sql`DELETE FROM skills WHERE did = 'did:plc:test-profile'`);
    await db.execute(sql`DELETE FROM education WHERE did = 'did:plc:test-profile'`);
    await db.execute(sql`DELETE FROM positions WHERE did = 'did:plc:test-profile'`);
    await db.execute(sql`DELETE FROM profiles WHERE did = 'did:plc:test-profile'`);
    await db.$client.end();
    await app.close();
    rmSync(tmpKeysDir, { recursive: true });
  });

  it('returns profile with positions, education, skills by handle', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/profile/testuser.bsky.social' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.did).toBe('did:plc:test-profile');
    expect(body.handle).toBe('testuser.bsky.social');
    expect(body.headline).toBe('Test Engineer');
    expect(body.positions).toHaveLength(1);
    expect(body.positions[0].companyName).toBe('Test Corp');
    expect(body.education).toHaveLength(1);
    expect(body.skills).toHaveLength(1);
  });

  it('returns profile by DID', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/profile/did:plc:test-profile' });
    expect(res.statusCode).toBe(200);
    expect(res.json().handle).toBe('testuser.bsky.social');
  });

  it('returns 404 for unknown handle', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/profile/nonexistent.bsky.social' });
    expect(res.statusCode).toBe(404);
  });

  it('returns follower and following counts', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/profile/testuser.bsky.social' });
    const body = res.json();
    expect(body.followersCount).toBeDefined();
    expect(body.followingCount).toBeDefined();
    expect(body.connectionsCount).toBeDefined();
    expect(typeof body.followersCount).toBe('number');
    expect(typeof body.followingCount).toBe('number');
  });
});
