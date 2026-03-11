import type { Database } from '../../db/index.js';
import { languages } from '../../db/schema/index.js';
import { and, eq } from 'drizzle-orm';
import type { JetstreamEvent } from '../types.js';
import { logger } from '../../logger.js';
import { sanitize } from '../../lib/sanitize.js';

export function createLanguageIndexer(db: Database) {
  return async (event: JetstreamEvent) => {
    const { did, commit } = event;
    if (!commit) return;

    const { operation, rkey, record } = commit;

    if (operation === 'delete') {
      await db.delete(languages).where(and(eq(languages.did, did), eq(languages.rkey, rkey)));
      logger.info({ did, rkey }, 'Deleted language');
      return;
    }

    if (!record) return;

    await db
      .insert(languages)
      .values({
        did,
        rkey,
        name: sanitize(record.name as string),
        proficiency: (record.proficiency as string) ?? null,
        createdAt: new Date(record.createdAt as string),
        indexedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [languages.did, languages.rkey],
        set: {
          name: sanitize(record.name as string),
          proficiency: (record.proficiency as string) ?? null,
          indexedAt: new Date(),
        },
      });

    logger.info({ did, rkey, operation }, 'Indexed language');
  };
}
