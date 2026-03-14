import type { Database } from '../../db/index.js';
import { positions, skillPositionLinks } from '../../db/schema/index.js';
import { and, eq } from 'drizzle-orm';
import type { JetstreamEvent } from '../types.js';
import { logger } from '../../logger.js';
import { sanitize, sanitizeOptional } from '../../lib/sanitize.js';

interface StrongRef {
  uri: string;
  cid: string;
}

/** Extract rkey from an AT Protocol URI: at://did/collection/rkey */
function parseRkeyFromUri(uri: string): string | null {
  const parts = uri.split('/');
  return parts.length >= 5 ? (parts[4] ?? null) : null;
}

interface RecordLocation {
  country?: string;
  region?: string;
  city?: string;
  countryCode?: string;
}

export function createPositionIndexer(db: Database) {
  return async (event: JetstreamEvent) => {
    const { did, commit } = event;
    if (!commit) return;

    const { operation, rkey, record } = commit;

    if (operation === 'delete') {
      await db
        .delete(skillPositionLinks)
        .where(and(eq(skillPositionLinks.did, did), eq(skillPositionLinks.positionRkey, rkey)));
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
        countryCode: sanitizeOptional(location?.countryCode) ?? null,
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
          countryCode: sanitizeOptional(location?.countryCode) ?? null,
          startDate: record.startDate as string,
          endDate: (record.endDate as string) ?? null,
          current: (record.current as boolean) ?? false,
          indexedAt: new Date(),
        },
      });

    // Sync skill-position links: delete-and-replace strategy
    await db
      .delete(skillPositionLinks)
      .where(and(eq(skillPositionLinks.did, did), eq(skillPositionLinks.positionRkey, rkey)));

    const skillRefs = record.skills as StrongRef[] | undefined;
    if (skillRefs && Array.isArray(skillRefs) && skillRefs.length > 0) {
      const linkValues = skillRefs
        .map((ref) => {
          const skillRkey = parseRkeyFromUri(ref.uri);
          if (!skillRkey) {
            logger.warn({ did, rkey, uri: ref.uri }, 'Could not parse skill rkey from strongRef URI');
            return null;
          }
          return { did, positionRkey: rkey, skillRkey };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);

      if (linkValues.length > 0) {
        await db.insert(skillPositionLinks).values(linkValues).onConflictDoNothing();
      }
    }

    logger.info({ did, rkey, operation, skillLinks: skillRefs?.length ?? 0 }, 'Indexed position');
  };
}
