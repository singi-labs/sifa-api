import { eq } from 'drizzle-orm';
import type { AtpAgent } from '@atproto/api';
import type { FastifyBaseLogger } from 'fastify';
import type { Database } from '../db/index.js';
import type { ValkeyClient } from '../cache/index.js';
import { featuredProfiles, profiles } from '../db/schema/index.js';
import { selectFeaturedProfile, getTodayUtc } from './featured-profile.js';
import { buildFeaturedPost, postToBluesky } from './featured-poster.js';

export const FEATURED_CACHE_KEY = 'featured:today';

const BLUESKY_POST_HOUR_UTC = 12; // Post at 12:00 UTC (14:00 CET, 05:00 PT)

function msUntilMidnightUtc(): number {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return tomorrow.getTime() - now.getTime();
}

function msUntilPostTimeUtc(): number {
  const now = new Date();
  const postTime = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), BLUESKY_POST_HOUR_UTC),
  );
  // If post time already passed today, schedule for tomorrow
  if (postTime.getTime() <= now.getTime()) {
    postTime.setUTCDate(postTime.getUTCDate() + 1);
  }
  return postTime.getTime() - now.getTime();
}

function isPostTimePassed(): boolean {
  return new Date().getUTCHours() >= BLUESKY_POST_HOUR_UTC;
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
  const profileUrl = `${publicUrl}/p/${profile.handle}`;
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
): { selectionTimer: NodeJS.Timeout; postTimer: NodeJS.Timeout } {
  // --- Selection job: runs at midnight UTC, picks the daily profile ---
  async function runSelection(): Promise<void> {
    try {
      const today = getTodayUtc();
      log.info({ date: today }, 'Running featured profile selection');

      const [existing] = await db
        .select()
        .from(featuredProfiles)
        .where(eq(featuredProfiles.featuredDate, today))
        .limit(1);

      if (existing) {
        log.info({ date: today }, 'Featured profile already selected for today');
        return;
      }

      const selected = await selectFeaturedProfile(db);
      if (!selected) {
        log.warn('No eligible profiles found for featured profile of the day');
        if (valkey) await valkey.del(FEATURED_CACHE_KEY);
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
        log.warn({ did: selected.did }, 'Selected profile is same as yesterday, skipping');
        return;
      }

      await db.insert(featuredProfiles).values({
        did: selected.did,
        featuredDate: today,
      });
      log.info({ did: selected.did, date: today }, 'Featured profile selected for today');

      if (valkey) await valkey.del(FEATURED_CACHE_KEY);
    } catch (err) {
      log.error({ err }, 'Featured profile selection failed');
    }
  }

  // --- Post job: runs at 12:00 UTC, posts to Bluesky ---
  async function runPost(): Promise<void> {
    if (!botAgent) return;
    try {
      const today = getTodayUtc();
      const [entry] = await db
        .select()
        .from(featuredProfiles)
        .where(eq(featuredProfiles.featuredDate, today))
        .limit(1);

      if (!entry) {
        log.info({ date: today }, 'No featured profile for today, skipping Bluesky post');
        return;
      }

      if (entry.postedAt) {
        log.info({ date: today }, 'Bluesky post already sent for today');
        return;
      }

      log.info({ did: entry.did, date: today }, 'Posting featured profile to Bluesky');
      await tryPost(db, botAgent, entry.did, today, publicUrl, log);
    } catch (err) {
      log.error({ err }, 'Featured profile Bluesky post failed');
    }
  }

  function scheduleSelection(): NodeJS.Timeout {
    const ms = msUntilMidnightUtc();
    log.info(
      { ms, hours: Math.round((ms / 3600000) * 10) / 10 },
      'Next featured profile selection scheduled (midnight UTC)',
    );
    return setTimeout(() => {
      void runSelection().finally(() => {
        scheduleSelection();
      });
    }, ms);
  }

  function schedulePost(): NodeJS.Timeout {
    const ms = msUntilPostTimeUtc();
    log.info(
      { ms, hours: Math.round((ms / 3600000) * 10) / 10, postHourUtc: BLUESKY_POST_HOUR_UTC },
      'Next Bluesky post scheduled',
    );
    return setTimeout(() => {
      void runPost().finally(() => {
        schedulePost();
      });
    }, ms);
  }

  // On startup: always run selection (catches restarts that missed midnight)
  void runSelection();
  // On startup: run post only if it's past post time and not yet posted
  if (isPostTimePassed()) {
    void runPost();
  }

  return {
    selectionTimer: scheduleSelection(),
    postTimer: schedulePost(),
  };
}
