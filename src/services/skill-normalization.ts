import type { Database } from '../db/index.js';
import { canonicalSkills, unresolvedSkills } from '../db/schema/index.js';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../logger.js';

/** Normalize a skill name for matching: lowercase, trim, collapse whitespace */
export function normalizeSkillName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Create a URL-safe slug from a skill name */
export function createSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/c\+\+/gi, 'c-plus-plus')
    .replace(/c#/gi, 'c-sharp')
    .replace(/\.net/gi, 'dot-net')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Resolve a user-entered skill name to a canonical skill.
 * Pipeline: normalize -> check slug match -> check aliases -> queue as unresolved.
 * Returns the canonical skill row if matched, null if unresolved.
 */
export async function resolveSkill(
  db: Database,
  rawName: string,
): Promise<typeof canonicalSkills.$inferSelect | null> {
  const normalized = normalizeSkillName(rawName);

  // 1. Exact match on slug
  const bySlug = await db
    .select()
    .from(canonicalSkills)
    .where(eq(canonicalSkills.slug, createSlug(rawName)))
    .limit(1);
  if (bySlug[0]) {
    return bySlug[0];
  }

  // 2. Check aliases array (any canonical_skills row where normalized name is in aliases)
  const byAlias = await db
    .select()
    .from(canonicalSkills)
    .where(sql`${normalized} = ANY(${canonicalSkills.aliases})`)
    .limit(1);
  if (byAlias[0]) {
    return byAlias[0];
  }

  // 3. No match -- add to unresolved queue
  await db
    .insert(unresolvedSkills)
    .values({
      rawName,
      normalizedName: normalized,
    })
    .onConflictDoUpdate({
      target: unresolvedSkills.normalizedName,
      set: {
        occurrences: sql`${unresolvedSkills.occurrences} + 1`,
      },
    });

  logger.info({ rawName, normalized }, 'Skill queued as unresolved');
  return null;
}
