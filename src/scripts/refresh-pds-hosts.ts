/**
 * Re-resolves pdsHost for all profiles.
 * Run monthly via cron or manually: DATABASE_URL=... pnpm refresh:pds
 */
import { eq } from 'drizzle-orm';
import { createDb } from '../db/index.js';
import { profiles } from '../db/schema/index.js';
import { resolvePdsHost } from '../lib/pds-provider.js';
import { logger as rootLogger } from '../logger.js';

const logger = rootLogger.child({ script: 'refresh-pds-hosts' });

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

const db = createDb(url);

const allProfiles = await db
  .select({ did: profiles.did, pdsHost: profiles.pdsHost })
  .from(profiles);

logger.info({ total: allProfiles.length }, 'Starting PDS host refresh');

let updated = 0;
let unchanged = 0;
let failed = 0;

for (const profile of allProfiles) {
  try {
    const resolved = await resolvePdsHost(profile.did);
    if (!resolved) {
      failed++;
      continue;
    }
    if (resolved !== profile.pdsHost) {
      await db.update(profiles).set({ pdsHost: resolved }).where(eq(profiles.did, profile.did));
      logger.info({ did: profile.did, old: profile.pdsHost, new: resolved }, 'Updated PDS host');
      updated++;
    } else {
      unchanged++;
    }
  } catch (err) {
    logger.warn({ did: profile.did, err }, 'Failed to resolve PDS host');
    failed++;
  }
}

logger.info({ updated, unchanged, failed, total: allProfiles.length }, 'PDS host refresh complete');
process.exit(0);
