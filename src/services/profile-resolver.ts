import { Agent } from '@atproto/api';
import type { Database } from '../db/index.js';
import { profiles } from '../db/schema/index.js';
import type { FastifyBaseLogger } from 'fastify';

const PUBLIC_API = 'https://public.api.bsky.app';
const BATCH_SIZE = 25;

interface ResolvedProfile {
  did: string;
  handle: string;
  displayName?: string;
  avatarUrl?: string;
}

/**
 * Resolves profiles from the public Bluesky API for DIDs that don't
 * already have profile data in the local database.
 * Only inserts profiles for DIDs that are actual Sifa users (have sessions).
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

  const resolved = await fetchProfilesFromBluesky(missing, logger);
  let upserted = 0;
  const now = new Date();

  for (const profile of resolved) {
    try {
      await db
        .insert(profiles)
        .values({
          did: profile.did,
          handle: profile.handle,
          displayName: profile.displayName ?? null,
          avatarUrl: profile.avatarUrl ?? null,
          createdAt: now,
        })
        .onConflictDoNothing();
      upserted++;
    } catch (err) {
      logger.debug({ err, did: profile.did }, 'Profile upsert failed');
    }
  }

  return upserted;
}

/**
 * Fetches profile data from the public Bluesky API without persisting.
 * Used to display names/avatars for "Not on Sifa" suggestion cards.
 */
export async function fetchProfilesFromBluesky(
  dids: string[],
  logger: FastifyBaseLogger,
): Promise<ResolvedProfile[]> {
  if (dids.length === 0) return [];

  const publicAgent = new Agent(PUBLIC_API);
  const results: ResolvedProfile[] = [];

  for (let i = 0; i < dids.length; i += BATCH_SIZE) {
    const batch = dids.slice(i, i + BATCH_SIZE);
    try {
      const res = await publicAgent.getProfiles(
        { actors: batch },
        { signal: AbortSignal.timeout(10000) },
      );
      for (const profile of res.data.profiles) {
        results.push({
          did: profile.did,
          handle: profile.handle,
          displayName: profile.displayName,
          avatarUrl: profile.avatar,
        });
      }
    } catch (err) {
      logger.warn({ err, batchStart: i, batchSize: batch.length }, 'Profile batch resolve failed');
    }
  }

  return results;
}
