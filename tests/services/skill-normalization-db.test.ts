import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDb } from '../../src/db/index.js';
import { canonicalSkills, unresolvedSkills } from '../../src/db/schema/index.js';
import { resolveSkill } from '../../src/services/skill-normalization.js';
import { eq, sql } from 'drizzle-orm';

describe('resolveSkill (integration)', () => {
  const db = createDb(process.env.DATABASE_URL ?? 'postgresql://sifa:sifa@localhost:5432/sifa');

  beforeAll(async () => {
    await db
      .insert(canonicalSkills)
      .values({
        canonicalName: 'JavaScript',
        slug: 'javascript',
        category: 'technical',
        aliases: ['js', 'javascript', 'ecmascript', 'java script'],
        userCount: 0,
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await db.delete(canonicalSkills).where(eq(canonicalSkills.slug, 'javascript'));
    await db.execute(
      sql`DELETE FROM unresolved_skills WHERE normalized_name IN ('javascript', 'completely-unknown-skill-xyz')`,
    );
    await db.$client.end();
  });

  it('resolves an alias to canonical skill', async () => {
    const result = await resolveSkill(db, 'JS');
    expect(result).not.toBeNull();
    expect(result?.canonicalName).toBe('JavaScript');
    expect(result?.slug).toBe('javascript');
  });

  it('resolves exact canonical name', async () => {
    const result = await resolveSkill(db, 'JavaScript');
    expect(result).not.toBeNull();
    expect(result?.canonicalName).toBe('JavaScript');
  });

  it('returns null and queues unresolved skill when no match found', async () => {
    const result = await resolveSkill(db, 'completely-unknown-skill-xyz');
    expect(result).toBeNull();

    const unresolved = await db
      .select()
      .from(unresolvedSkills)
      .where(eq(unresolvedSkills.normalizedName, 'completely-unknown-skill-xyz'));
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].occurrences).toBe(1);
  });

  it('increments occurrence count for repeated unresolved skills', async () => {
    await resolveSkill(db, 'completely-unknown-skill-xyz');
    const unresolved = await db
      .select()
      .from(unresolvedSkills)
      .where(eq(unresolvedSkills.normalizedName, 'completely-unknown-skill-xyz'));
    expect(unresolved[0].occurrences).toBe(2);
  });
});
