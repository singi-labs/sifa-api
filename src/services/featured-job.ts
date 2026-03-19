import { eq } from 'drizzle-orm';
import type { AtpAgent } from '@atproto/api';
import type { FastifyBaseLogger } from 'fastify';
import type { Database } from '../db/index.js';
import type { ValkeyClient } from '../cache/index.js';
import { featuredProfiles, profiles } from '../db/schema/index.js';
import { selectFeaturedProfile, getTodayUtc } from './featured-profile.js';
import { buildFeaturedPost, postToBluesky } from './featured-poster.js';

export const FEATURED_CACHE_KEY = 'featured:today';

function msUntilMidnightUtc(): number {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return tomorrow.getTime() - now.getTime();
}

async function tryPost(
  db: Database,
  botAgent: AtpAgent,
  did: string,
  dateStr: string,
  publicUrl: string,
  log: FastifyBaseLogger,
): Promise<void> {
  const [profile] = await db
    .select({ handle: profiles.handle, displayName: profiles.displayName })
    .from(profiles)
    .where(eq(profiles.did, did))
    .limit(1);

  if (!profile) {
    log.warn({ did }, 'Featured profile not found in profiles table — skipping post');
    return;
  }

  const displayName = profile.displayName ?? profile.handle;
  const profileUrl = `${publicUrl}/profile/${profile.handle}`;
  const post = buildFeaturedPost({ displayName, handle: profile.handle, did, dateStr, profileUrl });
  const posted = await postToBluesky(botAgent, post, log);

  if (posted) {
    await db
      .update(featuredProfiles)
      .set({ postedAt: new Date() })
      .where(eq(featuredProfiles.featuredDate, dateStr));
    log.info({ did, dateStr }, 'Featured profile posted to Bluesky');
  }
}

export function startFeaturedProfileJob(
  db: Database,
  valkey: ValkeyClient | null,
  botAgent: AtpAgent | null,
  publicUrl: string,
  log: FastifyBaseLogger,
): NodeJS.Timeout {
  async function run(): Promise<void> {
    try {
      const today = getTodayUtc();
      log.info({ date: today }, 'Running featured profile job');

      // Check if we already have a row for today
      const [existing] = await db
        .select()
        .from(featuredProfiles)
        .where(eq(featuredProfiles.featuredDate, today))
        .limit(1);

      if (existing) {
        if (existing.postedAt) {
          log.info({ date: today }, 'Featured profile already selected and posted for today');
          return;
        }
        // Row exists but not posted — retry posting if bot is available
        if (botAgent) {
          log.info(
            { did: existing.did, date: today },
            "Retrying Bluesky post for today's featured profile",
          );
          await tryPost(db, botAgent, existing.did, today, publicUrl, log);
        }
        return;
      }

      // Select a new featured profile
      const selected = await selectFeaturedProfile(db);
      if (!selected) {
        log.warn('No eligible profiles found for featured profile of the day');
        if (valkey) {
          await valkey.del(FEATURED_CACHE_KEY);
        }
        return;
      }

      // Belt-and-suspenders: check yesterday's featured profile isn't the same
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      const [yesterdayRow] = await db
        .select()
        .from(featuredProfiles)
        .where(eq(featuredProfiles.featuredDate, yesterdayStr))
        .limit(1);

      if (yesterdayRow && yesterdayRow.did === selected.did) {
        log.warn({ did: selected.did }, 'Selected profile is same as yesterday — skipping');
        return;
      }

      // Insert new featured profile row
      await db.insert(featuredProfiles).values({
        did: selected.did,
        featuredDate: today,
      });
      log.info({ did: selected.did, date: today }, 'Featured profile selected for today');

      // Clear cache so the API endpoint picks up the new selection
      if (valkey) {
        await valkey.del(FEATURED_CACHE_KEY);
      }

      // Post to Bluesky if bot is available
      if (botAgent) {
        await tryPost(db, botAgent, selected.did, today, publicUrl, log);
      }
    } catch (err) {
      log.error({ err }, 'Featured profile job failed');
    }
  }

  function schedule(): NodeJS.Timeout {
    const ms = msUntilMidnightUtc();
    log.info(
      { ms, hours: Math.round((ms / 3600000) * 10) / 10 },
      'Next featured profile job scheduled',
    );
    return setTimeout(() => {
      void run().finally(() => {
        schedule();
      });
    }, ms);
  }

  // Run immediately on startup, then schedule midnight runs
  void run();
  return schedule();
}
