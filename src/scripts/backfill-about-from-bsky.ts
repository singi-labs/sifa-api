/**
 * One-off backfill: populate empty `about` fields from Bluesky bio.
 *
 * Usage: DATABASE_URL=... tsx src/scripts/backfill-about-from-bsky.ts
 */
import { Agent } from '@atproto/api';
import { eq, isNull, or } from 'drizzle-orm';
import { createDb } from '../db/index.js';
import { profiles } from '../db/schema/index.js';
import { sanitizeOptional } from '../lib/sanitize.js';
import { logger } from '../logger.js';

const PUBLIC_API = 'https://public.api.bsky.app';
const BATCH_SIZE = 25;

const url = process.env.DATABASE_URL;
if (!url) {
  logger.error('DATABASE_URL is required');
  process.exit(1);
}

const db = createDb(url);
const publicAgent = new Agent(PUBLIC_API);

// Find all profiles with empty about
const emptyProfiles = await db
  .select({ did: profiles.did })
  .from(profiles)
  .where(or(isNull(profiles.about), eq(profiles.about, '')));

logger.info({ count: emptyProfiles.length }, 'Profiles with empty about');

let updated = 0;
let skipped = 0;

for (let i = 0; i < emptyProfiles.length; i += BATCH_SIZE) {
  const batch = emptyProfiles.slice(i, i + BATCH_SIZE);
  const dids = batch.map((p) => p.did);

  try {
    const res = await publicAgent.getProfiles(
      { actors: dids },
      { signal: AbortSignal.timeout(10000) },
    );

    for (const bskyProfile of res.data.profiles) {
      const bio = sanitizeOptional(bskyProfile.description);
      if (!bio) {
        skipped++;
        continue;
      }

      await db
        .update(profiles)
        .set({ about: bio, updatedAt: new Date() })
        .where(eq(profiles.did, bskyProfile.did));
      updated++;
      logger.info({ did: bskyProfile.did }, 'Backfilled about from Bluesky bio');
    }
  } catch (err) {
    logger.error({ err, batchStart: i }, 'Batch fetch failed, skipping');
  }
}

logger.info({ updated, skipped, total: emptyProfiles.length }, 'Backfill complete');
process.exit(0);
