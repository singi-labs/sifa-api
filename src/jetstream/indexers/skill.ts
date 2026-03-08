import type { Database } from '../../db/index.js';
import { skills } from '../../db/schema/index.js';
import { and, eq } from 'drizzle-orm';
import type { JetstreamEvent } from '../types.js';
import { logger } from '../../logger.js';
import { sanitize, sanitizeOptional } from '../../lib/sanitize.js';

export function createSkillIndexer(db: Database) {
  return async (event: JetstreamEvent) => {
    const { did, commit } = event;
    if (!commit) return;

    const { operation, rkey, record } = commit;

    if (operation === 'delete') {
      await db.delete(skills).where(and(eq(skills.did, did), eq(skills.rkey, rkey)));
      logger.info({ did, rkey }, 'Deleted skill');
      return;
    }

    if (!record) return;

    await db
      .insert(skills)
      .values({
        did,
        rkey,
        skillName: sanitize(record.skillName as string),
        category: sanitizeOptional(record.category as string | undefined) ?? null,
        createdAt: new Date(record.createdAt as string),
        indexedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [skills.did, skills.rkey],
        set: {
          skillName: sanitize(record.skillName as string),
          category: sanitizeOptional(record.category as string | undefined) ?? null,
          indexedAt: new Date(),
        },
      });

    logger.info({ did, rkey, operation }, 'Indexed skill');
  };
}
