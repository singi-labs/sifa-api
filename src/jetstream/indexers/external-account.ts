import type { Database } from '../../db/index.js';
import { externalAccounts } from '../../db/schema/index.js';
import { and, eq } from 'drizzle-orm';
import type { JetstreamEvent } from '../types.js';
import { logger } from '../../logger.js';
import { sanitize, sanitizeOptional } from '../../lib/sanitize.js';

export function createExternalAccountIndexer(db: Database) {
  return async (event: JetstreamEvent) => {
    const { did, commit } = event;
    if (!commit) return;

    const { operation, rkey, record } = commit;

    if (operation === 'delete') {
      await db
        .delete(externalAccounts)
        .where(and(eq(externalAccounts.did, did), eq(externalAccounts.rkey, rkey)));
      logger.info({ did, rkey }, 'Deleted external account');
      return;
    }

    if (!record) return;

    await db
      .insert(externalAccounts)
      .values({
        did,
        rkey,
        platform: sanitize(record.platform as string),
        url: sanitize(record.url as string),
        label: sanitizeOptional(record.label as string | undefined) ?? null,
        feedUrl: sanitizeOptional(record.feedUrl as string | undefined) ?? null,
        isPrimary: (record.isPrimary as boolean) ?? false,
        createdAt: new Date(record.createdAt as string),
        indexedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [externalAccounts.did, externalAccounts.rkey],
        set: {
          platform: sanitize(record.platform as string),
          url: sanitize(record.url as string),
          label: sanitizeOptional(record.label as string | undefined) ?? null,
          feedUrl: sanitizeOptional(record.feedUrl as string | undefined) ?? null,
          isPrimary: (record.isPrimary as boolean) ?? false,
          indexedAt: new Date(),
        },
      });

    logger.info({ did, rkey, operation }, 'Indexed external account');
  };
}
