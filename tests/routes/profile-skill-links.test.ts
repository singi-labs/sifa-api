import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/server.js';
import { createDb } from '../../src/db/index.js';
import { profiles, positions, skills, skillPositionLinks } from '../../src/db/schema/index.js';
import { sql } from 'drizzle-orm';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

describe('Profile API -- skill-position links', () => {
  let app: FastifyInstance;
  const db = createDb(process.env.DATABASE_URL ?? 'postgresql://sifa:sifa@localhost:5432/sifa');
  const tmpKeysDir = join(tmpdir(), `sifa-test-keys-profile-skills-${Date.now()}`);
  const jwksPath = join(tmpKeysDir, 'jwks.json');
  const testDid = 'did:plc:profile-skill-link-test';

  beforeAll(async () => {
    mkdirSync(tmpKeysDir, { recursive: true });
    writeFileSync(jwksPath, JSON.stringify({ keys: [{ kty: 'EC', crv: 'P-256', kid: 'test' }] }));

    await db
      .insert(profiles)
      .values({
        did: testDid,
        handle: 'skill-link-profile.bsky.social',
        headline: 'Test Profile',
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(positions)
      .values({
        did: testDid,
        rkey: '3pos1',
        companyName: 'Acme',
        title: 'Engineer',
        startDate: '2024-01',
        current: true,
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(skills)
      .values({
        did: testDid,
        rkey: '3skill1',
        skillName: 'TypeScript',
        category: 'technical',
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(skillPositionLinks)
      .values({
        did: testDid,
        positionRkey: '3pos1',
        skillRkey: '3skill1',
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
    await db.execute(sql`DELETE FROM skill_position_links WHERE did = ${testDid}`);
    await db.execute(sql`DELETE FROM positions WHERE did = ${testDid}`);
    await db.execute(sql`DELETE FROM skills WHERE did = ${testDid}`);
    await db.execute(sql`DELETE FROM profiles WHERE did = ${testDid}`);
    await db.$client.end();
    await app.close();
    rmSync(tmpKeysDir, { recursive: true });
  });

  it('includes positionRkeys on skills in profile response', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/profile/${testDid}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const skill = body.skills.find((s: { rkey: string }) => s.rkey === '3skill1');
    expect(skill).toBeDefined();
    expect(skill.positionRkeys).toEqual(['3pos1']);
  });

  it('includes skillRkeys on positions in profile response', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/profile/${testDid}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const position = body.positions.find((p: { rkey: string }) => p.rkey === '3pos1');
    expect(position).toBeDefined();
    expect(position.skillRkeys).toEqual(['3skill1']);
  });
});
