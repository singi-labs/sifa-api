import type { Database } from '../../db/index.js';
import { skills, canonicalSkills } from '../../db/schema/index.js';
import { and, eq, sql } from 'drizzle-orm';
import type { JetstreamEvent } from '../types.js';
import { logger } from '../../logger.js';
import { sanitize, sanitizeOptional } from '../../lib/sanitize.js';
import { resolveSkill } from '../../services/skill-normalization.js';

export function createSkillIndexer(db: Database) {
  return async (event: JetstreamEvent) => {
    const { did, commit } = event;
    if (!commit) return;

    const { operation, rkey, record } = commit;

    if (operation === 'delete') {
      // Look up canonical_skill_id before deleting so we can decrement user_count
      const existing = await db
        .select({ canonicalSkillId: skills.canonicalSkillId })
        .from(skills)
        .where(and(eq(skills.did, did), eq(skills.rkey, rkey)))
        .limit(1);

      await db.delete(skills).where(and(eq(skills.did, did), eq(skills.rkey, rkey)));

      if (existing[0]?.canonicalSkillId) {
        await db
          .update(canonicalSkills)
          .set({ userCount: sql`GREATEST(${canonicalSkills.userCount} - 1, 0)` })
          .where(eq(canonicalSkills.id, existing[0].canonicalSkillId));
      }

      logger.info({ did, rkey }, 'Deleted skill');
      return;
    }

    if (!record) return;

    const skillName = sanitize(record.skillName as string);
    const category = sanitizeOptional(record.category as string | undefined) ?? null;

    // Run normalization pipeline
    const canonical = await resolveSkill(db, skillName);
    const canonicalSkillId = canonical?.id ?? null;

    // Check if this is an update (existing record may already be linked to a different canonical)
    const existing = await db
      .select({ canonicalSkillId: skills.canonicalSkillId })
      .from(skills)
      .where(and(eq(skills.did, did), eq(skills.rkey, rkey)))
      .limit(1);

    const previousCanonicalId = existing[0]?.canonicalSkillId ?? null;

    await db
      .insert(skills)
      .values({
        did,
        rkey,
        skillName,
        category,
        canonicalSkillId,
        createdAt: new Date(record.createdAt as string),
        indexedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [skills.did, skills.rkey],
        set: {
          skillName,
          category,
          canonicalSkillId,
          indexedAt: new Date(),
        },
      });

    // Update user_count: decrement old canonical (if changed), increment new
    if (previousCanonicalId && previousCanonicalId !== canonicalSkillId) {
      await db
        .update(canonicalSkills)
        .set({ userCount: sql`GREATEST(${canonicalSkills.userCount} - 1, 0)` })
        .where(eq(canonicalSkills.id, previousCanonicalId));
    }
    if (canonicalSkillId && canonicalSkillId !== previousCanonicalId) {
      await db
        .update(canonicalSkills)
        .set({ userCount: sql`${canonicalSkills.userCount} + 1` })
        .where(eq(canonicalSkills.id, canonicalSkillId));
    }

    logger.info({ did, rkey, operation, canonicalSkillId }, 'Indexed skill');
  };
}
