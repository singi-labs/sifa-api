import type { Database } from '../../db/index.js';
import { publications } from '../../db/schema/index.js';
import { and, eq } from 'drizzle-orm';
import type { JetstreamEvent } from '../types.js';
import { logger } from '../../logger.js';
import { sanitize, sanitizeOptional } from '../../lib/sanitize.js';

export function createPublicationIndexer(db: Database) {
  return async (event: JetstreamEvent) => {
    const { did, commit } = event;
    if (!commit) return;

    const { operation, rkey, record } = commit;

    if (operation === 'delete') {
      await db
        .delete(publications)
        .where(and(eq(publications.did, did), eq(publications.rkey, rkey)));
      logger.info({ did, rkey }, 'Deleted publication');
      return;
    }

    if (!record) return;

    await db
      .insert(publications)
      .values({
        did,
        rkey,
        title: sanitize(record.title as string),
        publisher: sanitizeOptional(record.publisher as string | undefined) ?? null,
        url: (record.url as string) ?? null,
        description: sanitizeOptional(record.description as string | undefined) ?? null,
        publishedAt: (record.publishedAt as string) ?? null,
        createdAt: new Date(record.createdAt as string),
        indexedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [publications.did, publications.rkey],
        set: {
          title: sanitize(record.title as string),
          publisher: sanitizeOptional(record.publisher as string | undefined) ?? null,
          url: (record.url as string) ?? null,
          description: sanitizeOptional(record.description as string | undefined) ?? null,
          publishedAt: (record.publishedAt as string) ?? null,
          indexedAt: new Date(),
        },
      });

    logger.info({ did, rkey, operation }, 'Indexed publication');
  };
}
