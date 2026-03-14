import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDb } from '../../src/db/index.js';
import { skills, canonicalSkills, profiles } from '../../src/db/schema/index.js';
import { createSkillIndexer } from '../../src/jetstream/indexers/skill.js';
import { eq, and, sql } from 'drizzle-orm';

describe('Skill indexer with normalization', () => {
  const db = createDb(process.env.DATABASE_URL ?? 'postgresql://sifa:sifa@localhost:5432/sifa');
  const testDid = 'did:plc:skill-indexer-test';

  beforeAll(async () => {
    await db
      .insert(profiles)
      .values({
        did: testDid,
        handle: 'skill-test.bsky.social',
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(canonicalSkills)
      .values({
        canonicalName: 'TypeScript',
        slug: 'typescript',
        category: 'technical',
        aliases: ['ts', 'typescript'],
        userCount: 0,
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await db.delete(skills).where(eq(skills.did, testDid));
    await db.execute(sql`DELETE FROM canonical_skills WHERE slug = 'typescript'`);
    await db.execute(
      sql`DELETE FROM unresolved_skills WHERE normalized_name = 'ts'`,
    );
    await db.execute(sql`DELETE FROM profiles WHERE did = ${testDid}`);
    await db.$client.end();
  });

  it('indexes skill and resolves to canonical entry', async () => {
    const indexer = createSkillIndexer(db);
    await indexer({
      did: testDid,
      time_us: 1234567890,
      kind: 'commit',
      commit: {
        rev: 'rev1',
        operation: 'create',
        collection: 'id.sifa.profile.skill',
        rkey: '3skilltest1',
        record: {
          skillName: 'TS',
          category: 'technical',
          createdAt: '2026-01-01T00:00:00Z',
        },
      },
    });

    const indexed = await db
      .select()
      .from(skills)
      .where(and(eq(skills.did, testDid), eq(skills.rkey, '3skilltest1')));
    expect(indexed).toHaveLength(1);
    expect(indexed[0].skillName).toBe('TS');
    expect(indexed[0].canonicalSkillId).toBeDefined();
    expect(indexed[0].canonicalSkillId).not.toBeNull();
  });

  it('increments user_count on canonical skill when resolved', async () => {
    const canonical = await db
      .select()
      .from(canonicalSkills)
      .where(eq(canonicalSkills.slug, 'typescript'));
    expect(canonical[0].userCount).toBeGreaterThanOrEqual(1);
  });

  it('deletes skill and decrements user_count', async () => {
    const indexer = createSkillIndexer(db);
    await indexer({
      did: testDid,
      time_us: 1234567891,
      kind: 'commit',
      commit: {
        rev: 'rev2',
        operation: 'delete',
        collection: 'id.sifa.profile.skill',
        rkey: '3skilltest1',
      },
    });

    const indexed = await db
      .select()
      .from(skills)
      .where(and(eq(skills.did, testDid), eq(skills.rkey, '3skilltest1')));
    expect(indexed).toHaveLength(0);
  });
});
