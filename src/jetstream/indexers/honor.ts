import type { Database } from '../../db/index.js';
import { honors } from '../../db/schema/index.js';
import { and, eq } from 'drizzle-orm';
import type { JetstreamEvent } from '../types.js';
import { logger } from '../../logger.js';
import { sanitize, sanitizeOptional } from '../../lib/sanitize.js';

export function createHonorIndexer(db: Database) {
  return async (event: JetstreamEvent) => {
    const { did, commit } = event;
    if (!commit) return;

    const { operation, rkey, record } = commit;

    if (operation === 'delete') {
      await db.delete(honors).where(and(eq(honors.did, did), eq(honors.rkey, rkey)));
      logger.info({ did, rkey }, 'Deleted honor');
      return;
    }

    if (!record) return;

    await db
      .insert(honors)
      .values({
        did,
        rkey,
        title: sanitize(record.title as string),
        issuer: sanitizeOptional(record.issuer as string | undefined) ?? null,
        description: sanitizeOptional(record.description as string | undefined) ?? null,
        awardedAt: (record.awardedAt as string) ?? null,
        createdAt: new Date(record.createdAt as string),
        indexedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [honors.did, honors.rkey],
        set: {
          title: sanitize(record.title as string),
          issuer: sanitizeOptional(record.issuer as string | undefined) ?? null,
          description: sanitizeOptional(record.description as string | undefined) ?? null,
          awardedAt: (record.awardedAt as string) ?? null,
          indexedAt: new Date(),
        },
      });

    logger.info({ did, rkey, operation }, 'Indexed honor');
  };
}
