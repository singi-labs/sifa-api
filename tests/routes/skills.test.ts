import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/server.js';
import { createDb } from '../../src/db/index.js';
import { canonicalSkills } from '../../src/db/schema/index.js';
import { sql } from 'drizzle-orm';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

describe('Skills Search API', () => {
  let app: FastifyInstance;
  const db = createDb(process.env.DATABASE_URL ?? 'postgresql://sifa:sifa@localhost:5432/sifa');
  const tmpKeysDir = join(tmpdir(), `sifa-test-keys-skills-${Date.now()}`);
  const jwksPath = join(tmpKeysDir, 'jwks.json');

  beforeAll(async () => {
    mkdirSync(tmpKeysDir, { recursive: true });
    writeFileSync(jwksPath, JSON.stringify({ keys: [{ kty: 'EC', crv: 'P-256', kid: 'test' }] }));

    // Ensure the table exists (migration may not have run in test mode)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "canonical_skills" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "canonical_name" text NOT NULL UNIQUE,
        "slug" text NOT NULL UNIQUE,
        "category" text,
        "subcategory" text,
        "aliases" text[] NOT NULL DEFAULT '{}',
        "wikidata_id" text,
        "user_count" integer NOT NULL DEFAULT 0
      )
    `);

    // Seed canonical skills for search
    await db
      .insert(canonicalSkills)
      .values([
        { canonicalName: 'JavaScript', slug: 'javascript', category: 'technical', aliases: ['js', 'javascript'], userCount: 150 },
        { canonicalName: 'TypeScript', slug: 'typescript', category: 'technical', aliases: ['ts', 'typescript'], userCount: 120 },
        { canonicalName: 'Java', slug: 'java', category: 'technical', aliases: ['java'], userCount: 80 },
        { canonicalName: 'Python', slug: 'python', category: 'technical', aliases: ['python', 'py'], userCount: 200 },
        { canonicalName: 'Project Management', slug: 'project-management', category: 'business', aliases: ['project management', 'pm'], userCount: 50 },
      ])
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
    await db.execute(sql`DELETE FROM canonical_skills WHERE slug IN ('javascript', 'typescript', 'java', 'python', 'project-management')`);
    await db.$client.end();
    await app.close();
    rmSync(tmpKeysDir, { recursive: true });
  });

  it('GET /api/skills/search returns matching skills ordered by similarity and user_count', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/search?q=java' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.skills.length).toBeGreaterThanOrEqual(2);
    const names = body.skills.map((s: { canonicalName: string }) => s.canonicalName);
    expect(names).toContain('JavaScript');
    expect(names).toContain('Java');
  });

  it('GET /api/skills/search returns 400 without query', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/search' });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/skills/search returns empty for no matches', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/search?q=xyznonexistent999' });
    expect(res.statusCode).toBe(200);
    expect(res.json().skills).toHaveLength(0);
  });

  it('GET /api/skills/search respects limit parameter', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/search?q=java&limit=1' });
    expect(res.statusCode).toBe(200);
    expect(res.json().skills).toHaveLength(1);
  });

  it('GET /api/skills/search includes category and user_count', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/search?q=python' });
    const body = res.json();
    const python = body.skills.find((s: { canonicalName: string }) => s.canonicalName === 'Python');
    expect(python).toBeDefined();
    expect(python.category).toBe('technical');
    expect(python.userCount).toBe(200);
    expect(python.slug).toBe('python');
  });

  it('GET /api/skills/search matches aliases', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/search?q=pm' });
    const body = res.json();
    const pm = body.skills.find((s: { canonicalName: string }) => s.canonicalName === 'Project Management');
    expect(pm).toBeDefined();
  });
});
