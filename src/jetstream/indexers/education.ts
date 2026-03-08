import type { Database } from '../../db/index.js';
import { education } from '../../db/schema/index.js';
import { and, eq } from 'drizzle-orm';
import type { JetstreamEvent } from '../types.js';
import { logger } from '../../logger.js';

export function createEducationIndexer(db: Database) {
  return async (event: JetstreamEvent) => {
    const { did, commit } = event;
    if (!commit) return;

    const { operation, rkey, record } = commit;

    if (operation === 'delete') {
      await db
        .delete(education)
        .where(and(eq(education.did, did), eq(education.rkey, rkey)));
      logger.info({ did, rkey }, 'Deleted education');
      return;
    }

    if (!record) return;

    await db
      .insert(education)
      .values({
        did,
        rkey,
        institution: record.institution as string,
        institutionDid: (record.institutionDid as string) ?? null,
        degree: (record.degree as string) ?? null,
        fieldOfStudy: (record.fieldOfStudy as string) ?? null,
        description: (record.description as string) ?? null,
        startDate: (record.startDate as string) ?? null,
        endDate: (record.endDate as string) ?? null,
        createdAt: new Date(record.createdAt as string),
        indexedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [education.did, education.rkey],
        set: {
          institution: record.institution as string,
          institutionDid: (record.institutionDid as string) ?? null,
          degree: (record.degree as string) ?? null,
          fieldOfStudy: (record.fieldOfStudy as string) ?? null,
          description: (record.description as string) ?? null,
          startDate: (record.startDate as string) ?? null,
          endDate: (record.endDate as string) ?? null,
          indexedAt: new Date(),
        },
      });

    logger.info({ did, rkey, operation }, 'Indexed education');
  };
}
