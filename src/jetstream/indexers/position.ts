import type { Database } from '../../db/index.js';
import { positions } from '../../db/schema/index.js';
import { and, eq } from 'drizzle-orm';
import type { JetstreamEvent } from '../types.js';
import { logger } from '../../logger.js';
import { sanitize, sanitizeOptional } from '../../lib/sanitize.js';

interface RecordLocation {
  country?: string;
  region?: string;
  city?: string;
}

export function createPositionIndexer(db: Database) {
  return async (event: JetstreamEvent) => {
    const { did, commit } = event;
    if (!commit) return;

    const { operation, rkey, record } = commit;

    if (operation === 'delete') {
      await db.delete(positions).where(and(eq(positions.did, did), eq(positions.rkey, rkey)));
      logger.info({ did, rkey }, 'Deleted position');
      return;
    }

    if (!record) return;

    const location = record.location as RecordLocation | undefined;

    await db
      .insert(positions)
      .values({
        did,
        rkey,
        companyName: sanitize(record.companyName as string),
        companyDid: (record.companyDid as string) ?? null,
        title: sanitize(record.title as string),
        description: sanitizeOptional(record.description as string | undefined) ?? null,
        employmentType: (record.employmentType as string) ?? null,
        workplaceType: (record.workplaceType as string) ?? null,
        locationCountry: sanitizeOptional(location?.country) ?? null,
        locationRegion: sanitizeOptional(location?.region) ?? null,
        locationCity: sanitizeOptional(location?.city) ?? null,
        startDate: record.startDate as string,
        endDate: (record.endDate as string) ?? null,
        current: (record.current as boolean) ?? false,
        createdAt: new Date(record.createdAt as string),
        indexedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [positions.did, positions.rkey],
        set: {
          companyName: sanitize(record.companyName as string),
          companyDid: (record.companyDid as string) ?? null,
          title: sanitize(record.title as string),
          description: sanitizeOptional(record.description as string | undefined) ?? null,
          employmentType: (record.employmentType as string) ?? null,
          workplaceType: (record.workplaceType as string) ?? null,
          locationCountry: sanitizeOptional(location?.country) ?? null,
          locationRegion: sanitizeOptional(location?.region) ?? null,
          locationCity: sanitizeOptional(location?.city) ?? null,
          startDate: record.startDate as string,
          endDate: (record.endDate as string) ?? null,
          current: (record.current as boolean) ?? false,
          indexedAt: new Date(),
        },
      });

    logger.info({ did, rkey, operation }, 'Indexed position');
  };
}
