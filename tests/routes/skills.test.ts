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

  const testSlugs = [
    'javascript',
    'typescript',
    'java',
    'python',
    'project-management',
    'react',
    'node-js',
  ];

  beforeAll(async () => {
    mkdirSync(tmpKeysDir, { recursive: true });
    writeFileSync(jwksPath, JSON.stringify({ keys: [{ kty: 'EC', crv: 'P-256', kid: 'test' }] }));

    // Ensure the table and pg_trgm extension exist
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "canonical_skills" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "canonical_name" text NOT NULL UNIQUE,
        "slug" text NOT NULL UNIQUE,
        "category" text NOT NULL DEFAULT 'technical',
        "subcategory" text,
        "aliases" text[] NOT NULL DEFAULT '{}',
        "wikidata_id" text,
        "user_count" integer NOT NULL DEFAULT 0,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now()
      )
    `);

    // Seed canonical skills for search
    await db
      .insert(canonicalSkills)
      .values([
        {
          canonicalName: 'JavaScript',
          slug: 'javascript',
          category: 'technical',
          aliases: ['js', 'ecmascript', 'es6'],
          userCount: 150,
        },
        {
          canonicalName: 'TypeScript',
          slug: 'typescript',
          category: 'technical',
          aliases: ['ts'],
          userCount: 120,
        },
        {
          canonicalName: 'Java',
          slug: 'java',
          category: 'technical',
          aliases: ['java se', 'java ee'],
          userCount: 80,
        },
        {
          canonicalName: 'Python',
          slug: 'python',
          category: 'technical',
          aliases: ['py', 'python3'],
          userCount: 200,
        },
        {
          canonicalName: 'Project Management',
          slug: 'project-management',
          category: 'business',
          aliases: ['pm', 'project planning'],
          userCount: 50,
        },
        {
          canonicalName: 'React',
          slug: 'react',
          category: 'technical',
          aliases: ['reactjs', 'react.js'],
          userCount: 130,
        },
        {
          canonicalName: 'Node.js',
          slug: 'node-js',
          category: 'technical',
          aliases: ['nodejs', 'node'],
          userCount: 110,
        },
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
    await db.execute(
      sql`DELETE FROM canonical_skills WHERE slug IN (${sql.join(
        testSlugs.map((s) => sql`${s}`),
        sql`, `,
      )})`,
    );
    await db.$client.end();
    await app.close();
    rmSync(tmpKeysDir, { recursive: true });
  });

  // --- Validation ---

  it('returns 400 without query parameter', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/search' });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('InvalidRequest');
  });

  it('returns 400 with empty q parameter', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/search?q=' });
    expect(res.statusCode).toBe(400);
  });

  // --- Basic search ---

  it('returns matching skills for a simple query', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/search?q=java' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.skills.length).toBeGreaterThanOrEqual(2);
    const names = body.skills.map((s: { canonicalName: string }) => s.canonicalName);
    expect(names).toContain('JavaScript');
    expect(names).toContain('Java');
  });

  it('returns empty array for no matches', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/search?q=xyznonexistent999' });
    expect(res.statusCode).toBe(200);
    expect(res.json().skills).toHaveLength(0);
  });

  // --- Response shape ---

  it('returns only canonicalName, slug, and category in response', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/search?q=python' });
    const body = res.json();
    const python = body.skills.find((s: { canonicalName: string }) => s.canonicalName === 'Python');
    expect(python).toBeDefined();
    expect(python.canonicalName).toBe('Python');
    expect(python.slug).toBe('python');
    expect(python.category).toBe('technical');
    // Should NOT include id, userCount, or other internal fields
    expect(python).not.toHaveProperty('id');
    expect(python).not.toHaveProperty('userCount');
    expect(python).not.toHaveProperty('user_count');
  });

  // --- Limit ---

  it('respects the limit parameter', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/search?q=java&limit=1' });
    expect(res.statusCode).toBe(200);
    expect(res.json().skills).toHaveLength(1);
  });

  it('defaults limit to 10', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/search?q=a' });
    expect(res.statusCode).toBe(200);
    expect(res.json().skills.length).toBeLessThanOrEqual(10);
  });

  it('rejects limit above 50', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/search?q=java&limit=100' });
    expect(res.statusCode).toBe(400);
  });

  // --- Fuzzy matching (typos) ---

  it('matches with typos via pg_trgm fuzzy search', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/search?q=javscript' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const names = body.skills.map((s: { canonicalName: string }) => s.canonicalName);
    expect(names).toContain('JavaScript');
  });

  it('matches with typos for typescript', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/search?q=typscript' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const names = body.skills.map((s: { canonicalName: string }) => s.canonicalName);
    expect(names).toContain('TypeScript');
  });

  // --- Alias matching ---

  it('matches aliases (JS -> JavaScript)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/search?q=js' });
    const body = res.json();
    const names = body.skills.map((s: { canonicalName: string }) => s.canonicalName);
    expect(names).toContain('JavaScript');
  });

  it('matches aliases (pm -> Project Management)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/search?q=pm' });
    const body = res.json();
    const pm = body.skills.find(
      (s: { canonicalName: string }) => s.canonicalName === 'Project Management',
    );
    expect(pm).toBeDefined();
  });

  it('matches aliases (nodejs -> Node.js)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/search?q=nodejs' });
    const body = res.json();
    const names = body.skills.map((s: { canonicalName: string }) => s.canonicalName);
    expect(names).toContain('Node.js');
  });

  // --- Exact slug match priority ---

  it('prioritizes exact slug match', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/search?q=java' });
    const body = res.json();
    // 'java' slug should match exactly, so Java should be first
    expect(body.skills[0].canonicalName).toBe('Java');
  });

  // --- Case insensitivity ---

  it('is case insensitive', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/search?q=PYTHON' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const names = body.skills.map((s: { canonicalName: string }) => s.canonicalName);
    expect(names).toContain('Python');
  });
});
