import type { Database } from '../../db/index.js';
import { positions } from '../../db/schema/index.js';
import { and, eq } from 'drizzle-orm';
import type { JetstreamEvent } from '../types.js';
import { logger } from '../../logger.js';

export function createPositionIndexer(db: Database) {
  return async (event: JetstreamEvent) => {
    const { did, commit } = event;
    if (!commit) return;

    const { operation, rkey, record } = commit;

    if (operation === 'delete') {
      await db
        .delete(positions)
        .where(and(eq(positions.did, did), eq(positions.rkey, rkey)));
      logger.info({ did, rkey }, 'Deleted position');
      return;
    }

    if (!record) return;

    await db
      .insert(positions)
      .values({
        did,
        rkey,
        companyName: record.companyName as string,
        companyDid: (record.companyDid as string) ?? null,
        title: record.title as string,
        description: (record.description as string) ?? null,
        employmentType: (record.employmentType as string) ?? null,
        workplaceType: (record.workplaceType as string) ?? null,
        locationCountry: (record.location as any)?.country ?? null,
        locationRegion: (record.location as any)?.region ?? null,
        locationCity: (record.location as any)?.city ?? null,
        startDate: record.startDate as string,
        endDate: (record.endDate as string) ?? null,
        current: (record.current as boolean) ?? false,
        createdAt: new Date(record.createdAt as string),
        indexedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [positions.did, positions.rkey],
        set: {
          companyName: record.companyName as string,
          companyDid: (record.companyDid as string) ?? null,
          title: record.title as string,
          description: (record.description as string) ?? null,
          employmentType: (record.employmentType as string) ?? null,
          workplaceType: (record.workplaceType as string) ?? null,
          locationCountry: (record.location as any)?.country ?? null,
          locationRegion: (record.location as any)?.region ?? null,
          locationCity: (record.location as any)?.city ?? null,
          startDate: record.startDate as string,
          endDate: (record.endDate as string) ?? null,
          current: (record.current as boolean) ?? false,
          indexedAt: new Date(),
        },
      });

    logger.info({ did, rkey, operation }, 'Indexed position');
  };
}
