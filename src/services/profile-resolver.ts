import { Agent } from '@atproto/api';
import type { Database } from '../db/index.js';
import { profiles } from '../db/schema/index.js';
import type { FastifyBaseLogger } from 'fastify';

const PUBLIC_API = 'https://public.api.bsky.app';
const BATCH_SIZE = 25;

/**
 * Resolves profiles from the public Bluesky API for DIDs that don't
 * already have profile data in the local database.
 * Returns the number of profiles resolved.
 */
export async function resolveAndUpsertProfiles(
  db: Database,
  dids: string[],
  logger: FastifyBaseLogger,
): Promise<number> {
  if (dids.length === 0) return 0;

  // Find which DIDs already have profile data
  const allExisting = await db.select({ did: profiles.did }).from(profiles);
  const existingDids = new Set(allExisting.map((r) => r.did));

  const missing = dids.filter((d) => !existingDids.has(d));
  if (missing.length === 0) return 0;

  const publicAgent = new Agent(PUBLIC_API);
  let resolved = 0;
  const now = new Date();

  // Resolve in batches using getProfiles (max 25 per request)
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);
    try {
      const res = await publicAgent.getProfiles(
        { actors: batch },
        { signal: AbortSignal.timeout(10000) },
      );
      for (const profile of res.data.profiles) {
        try {
          await db
            .insert(profiles)
            .values({
              did: profile.did,
              handle: profile.handle,
              displayName: profile.displayName ?? null,
              avatarUrl: profile.avatar ?? null,
              createdAt: now,
            })
            .onConflictDoNothing();
          resolved++;
        } catch (err) {
          logger.debug({ err, did: profile.did }, 'Profile upsert failed');
        }
      }
    } catch (err) {
      logger.warn({ err, batchStart: i, batchSize: batch.length }, 'Profile batch resolve failed');
    }
  }

  return resolved;
}
