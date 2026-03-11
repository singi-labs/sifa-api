import type { Database } from '../../db/index.js';
import { volunteering } from '../../db/schema/index.js';
import { and, eq } from 'drizzle-orm';
import type { JetstreamEvent } from '../types.js';
import { logger } from '../../logger.js';
import { sanitize, sanitizeOptional } from '../../lib/sanitize.js';

export function createVolunteeringIndexer(db: Database) {
  return async (event: JetstreamEvent) => {
    const { did, commit } = event;
    if (!commit) return;

    const { operation, rkey, record } = commit;

    if (operation === 'delete') {
      await db
        .delete(volunteering)
        .where(and(eq(volunteering.did, did), eq(volunteering.rkey, rkey)));
      logger.info({ did, rkey }, 'Deleted volunteering');
      return;
    }

    if (!record) return;

    await db
      .insert(volunteering)
      .values({
        did,
        rkey,
        organization: sanitize(record.organization as string),
        role: sanitizeOptional(record.role as string | undefined) ?? null,
        cause: sanitizeOptional(record.cause as string | undefined) ?? null,
        description: sanitizeOptional(record.description as string | undefined) ?? null,
        startedAt: (record.startedAt as string) ?? null,
        endedAt: (record.endedAt as string) ?? null,
        createdAt: new Date(record.createdAt as string),
        indexedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [volunteering.did, volunteering.rkey],
        set: {
          organization: sanitize(record.organization as string),
          role: sanitizeOptional(record.role as string | undefined) ?? null,
          cause: sanitizeOptional(record.cause as string | undefined) ?? null,
          description: sanitizeOptional(record.description as string | undefined) ?? null,
          startedAt: (record.startedAt as string) ?? null,
          endedAt: (record.endedAt as string) ?? null,
          indexedAt: new Date(),
        },
      });

    logger.info({ did, rkey, operation }, 'Indexed volunteering');
  };
}
