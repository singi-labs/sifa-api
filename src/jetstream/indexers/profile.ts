import type { Database } from '../../db/index.js';
import { profiles } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import type { JetstreamEvent } from '../types.js';
import { logger } from '../../logger.js';

export function createProfileIndexer(db: Database) {
  return async (event: JetstreamEvent) => {
    const { did, commit } = event;
    if (!commit) return;

    const { operation, record } = commit;

    if (operation === 'delete') {
      await db.delete(profiles).where(eq(profiles.did, did));
      logger.info({ did }, 'Deleted profile');
      return;
    }

    if (!record) return;

    await db
      .insert(profiles)
      .values({
        did,
        handle: '',
        headline: (record.headline as string) ?? null,
        about: (record.about as string) ?? null,
        industry: (record.industry as string) ?? null,
        locationCountry: (record.location as any)?.country ?? null,
        locationRegion: (record.location as any)?.region ?? null,
        locationCity: (record.location as any)?.city ?? null,
        website: (record.website as string) ?? null,
        openTo: (record.openTo as string[]) ?? null,
        preferredWorkplace: (record.preferredWorkplace as string[]) ?? null,
        langs: (record.langs as string[]) ?? null,
        createdAt: new Date(record.createdAt as string),
        indexedAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: profiles.did,
        set: {
          headline: (record.headline as string) ?? null,
          about: (record.about as string) ?? null,
          industry: (record.industry as string) ?? null,
          locationCountry: (record.location as any)?.country ?? null,
          locationRegion: (record.location as any)?.region ?? null,
          locationCity: (record.location as any)?.city ?? null,
          website: (record.website as string) ?? null,
          openTo: (record.openTo as string[]) ?? null,
          preferredWorkplace: (record.preferredWorkplace as string[]) ?? null,
          langs: (record.langs as string[]) ?? null,
          updatedAt: new Date(),
        },
      });

    logger.info({ did, operation }, 'Indexed profile');
  };
}
