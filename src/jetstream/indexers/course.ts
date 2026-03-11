import type { Database } from '../../db/index.js';
import { courses } from '../../db/schema/index.js';
import { and, eq } from 'drizzle-orm';
import type { JetstreamEvent } from '../types.js';
import { logger } from '../../logger.js';
import { sanitize, sanitizeOptional } from '../../lib/sanitize.js';

export function createCourseIndexer(db: Database) {
  return async (event: JetstreamEvent) => {
    const { did, commit } = event;
    if (!commit) return;

    const { operation, rkey, record } = commit;

    if (operation === 'delete') {
      await db.delete(courses).where(and(eq(courses.did, did), eq(courses.rkey, rkey)));
      logger.info({ did, rkey }, 'Deleted course');
      return;
    }

    if (!record) return;

    await db
      .insert(courses)
      .values({
        did,
        rkey,
        name: sanitize(record.name as string),
        number: sanitizeOptional(record.number as string | undefined) ?? null,
        institution: sanitizeOptional(record.institution as string | undefined) ?? null,
        createdAt: new Date(record.createdAt as string),
        indexedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [courses.did, courses.rkey],
        set: {
          name: sanitize(record.name as string),
          number: sanitizeOptional(record.number as string | undefined) ?? null,
          institution: sanitizeOptional(record.institution as string | undefined) ?? null,
          indexedAt: new Date(),
        },
      });

    logger.info({ did, rkey, operation }, 'Indexed course');
  };
}
