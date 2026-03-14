import type { Database } from '../../db/index.js';
import { profiles } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import type { JetstreamEvent } from '../types.js';
import { logger } from '../../logger.js';
import { sanitizeOptional } from '../../lib/sanitize.js';

interface RecordLocation {
  country?: string;
  region?: string;
  city?: string;
  countryCode?: string;
}

export function createProfileIndexer(db: Database) {
  return async (event: JetstreamEvent) => {
    const { did, commit } = event;
    if (!commit) return;

    const { operation, record } = commit;

    if (operation === 'delete') {
      // Clear profile fields but keep the row — deleting it would cascade to
      // positions/education/skills via FK onDelete:'cascade', wiping all data.
      await db
        .update(profiles)
        .set({
          headline: null,
          about: null,
          industry: null,
          locationCountry: null,
          locationRegion: null,
          locationCity: null,
          countryCode: null,
          openTo: null,
          preferredWorkplace: null,
          langs: null,
          updatedAt: new Date(),
        })
        .where(eq(profiles.did, did));
      logger.info({ did }, 'Cleared profile fields (row preserved)');
      return;
    }

    if (!record) return;

    const location = record.location as RecordLocation | undefined;

    await db
      .insert(profiles)
      .values({
        did,
        handle: '',
        headline: sanitizeOptional(record.headline as string | undefined) ?? null,
        about: sanitizeOptional(record.about as string | undefined) ?? null,
        industry: sanitizeOptional(record.industry as string | undefined) ?? null,
        locationCountry: sanitizeOptional(location?.country) ?? null,
        locationRegion: sanitizeOptional(location?.region) ?? null,
        locationCity: sanitizeOptional(location?.city) ?? null,
        countryCode: sanitizeOptional(location?.countryCode) ?? null,
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
          headline: sanitizeOptional(record.headline as string | undefined) ?? null,
          about: sanitizeOptional(record.about as string | undefined) ?? null,
          industry: sanitizeOptional(record.industry as string | undefined) ?? null,
          locationCountry: sanitizeOptional(location?.country) ?? null,
          locationRegion: sanitizeOptional(location?.region) ?? null,
          locationCity: sanitizeOptional(location?.city) ?? null,
          countryCode: sanitizeOptional(location?.countryCode) ?? null,
          openTo: (record.openTo as string[]) ?? null,
          preferredWorkplace: (record.preferredWorkplace as string[]) ?? null,
          langs: (record.langs as string[]) ?? null,
          updatedAt: new Date(),
        },
      });

    logger.info({ did, operation }, 'Indexed profile');
  };
}
