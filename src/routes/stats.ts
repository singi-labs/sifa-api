import { and, count, isNotNull, ne, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Database } from '../db/index.js';
import type { ValkeyClient } from '../cache/index.js';
import { profiles } from '../db/schema/index.js';

const PROFILE_COUNT_KEY = 'stats:profile-count';
const PROFILE_COUNT_TTL = 900; // 15 minutes

const ATPROTO_STATS_KEY = 'stats:atproto';
const ATPROTO_STATS_TTL = 86400; // 24 hours

const AVATARS_KEY = 'stats:avatars';
const AVATARS_TTL = 900; // 15 minutes

// Estimated non-Bluesky ATProto DIDs from PLC directory sampling (2026-03-15).
// bsky-users.theo.io tracks Bluesky accounts only (~43M). PLC directory holds
// all ATProto DIDs including Blacksky, Northsky, Eurosky etc. (~60M).
const PLC_OFFSET = 17_000_000;

interface AtprotoStats {
  userCount: number;
  growthPerSecond: number;
  timestamp: number;
}

async function fetchAtprotoStats(): Promise<AtprotoStats | null> {
  try {
    const res = await fetch('https://bsky-users.theo.io/', {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const countMatch = html.match(/"last_user_count":(\d+)/);
    const growthMatch = html.match(/"growth_per_second":([\d.]+)/);
    const tsMatch = html.match(/"timestamp":(\d+)/);

    if (!countMatch) return null;

    return {
      userCount: Number(countMatch[1]),
      growthPerSecond: growthMatch ? Number(growthMatch[1]) : 0,
      timestamp: tsMatch ? Number(tsMatch[1]) : Math.floor(Date.now() / 1000),
    };
  } catch {
    return null;
  }
}

export function registerStatsRoutes(
  app: FastifyInstance,
  db: Database,
  valkey: ValkeyClient | null,
) {
  app.get('/api/stats', async (_request, reply) => {
    // --- Profile count (15 min cache) ---
    let profileCount = 0;
    if (valkey) {
      const cached = await valkey.get(PROFILE_COUNT_KEY);
      if (cached !== null) {
        profileCount = Number(cached);
      } else {
        const [result] = await db.select({ value: count() }).from(profiles);
        profileCount = result?.value ?? 0;
        await valkey.setex(PROFILE_COUNT_KEY, PROFILE_COUNT_TTL, String(profileCount));
      }
    } else {
      const [result] = await db.select({ value: count() }).from(profiles);
      profileCount = result?.value ?? 0;
    }

    // --- ATProto stats (24h cache) ---
    let atproto: AtprotoStats | null = null;
    if (valkey) {
      const cached = await valkey.get(ATPROTO_STATS_KEY);
      if (cached !== null) {
        atproto = JSON.parse(cached) as AtprotoStats;
      } else {
        atproto = await fetchAtprotoStats();
        if (atproto) {
          await valkey.setex(ATPROTO_STATS_KEY, ATPROTO_STATS_TTL, JSON.stringify(atproto));
        }
      }
    } else {
      atproto = await fetchAtprotoStats();
    }

    // --- Avatars (15 min cache) ---
    let avatars: string[] = [];
    if (valkey) {
      const cached = await valkey.get(AVATARS_KEY);
      if (cached !== null) {
        avatars = JSON.parse(cached) as string[];
      } else {
        const rows = await db
          .select({ avatarUrl: profiles.avatarUrl })
          .from(profiles)
          .where(and(isNotNull(profiles.avatarUrl), ne(profiles.avatarUrl, '')))
          .orderBy(sql`random()`)
          .limit(30);
        avatars = rows.map((r) => r.avatarUrl).filter((url): url is string => url !== null);
        await valkey.setex(AVATARS_KEY, AVATARS_TTL, JSON.stringify(avatars));
      }
    } else {
      const rows = await db
        .select({ avatarUrl: profiles.avatarUrl })
        .from(profiles)
        .where(and(isNotNull(profiles.avatarUrl), ne(profiles.avatarUrl, '')))
        .orderBy(sql`random()`)
        .limit(30);
      avatars = rows.map((r) => r.avatarUrl).filter((url): url is string => url !== null);
    }

    return reply.send({
      profileCount,
      avatars,
      atproto: atproto
        ? {
            userCount: atproto.userCount + PLC_OFFSET,
            growthPerSecond: atproto.growthPerSecond,
            timestamp: atproto.timestamp,
          }
        : null,
    });
  });
}
