import { eq, and, count } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Database } from '../db/index.js';
import type { ValkeyClient } from '../cache/index.js';
import {
  featuredProfiles,
  profiles,
  positions,
  externalAccounts,
  connections,
} from '../db/schema/index.js';
import { resolveProfileFields } from '../lib/resolve-profile.js';
import { FEATURED_CACHE_KEY } from '../services/featured-job.js';
import { getTodayUtc } from '../services/featured-profile.js';

function secondsUntilMidnightUtc(): number {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return Math.ceil((tomorrow.getTime() - now.getTime()) / 1000);
}

export function registerFeaturedRoutes(
  app: FastifyInstance,
  db: Database,
  valkey: ValkeyClient | null,
) {
  app.get('/api/featured-profile', async (_request, reply) => {
    // Check cache first
    if (valkey) {
      const cached = await valkey.get(FEATURED_CACHE_KEY);
      if (cached !== null) {
        if (cached === 'null') {
          return reply.status(204).send();
        }
        return reply.send(JSON.parse(cached));
      }
    }

    const today = getTodayUtc();

    // Query today's featured profile
    const [featured] = await db
      .select()
      .from(featuredProfiles)
      .where(eq(featuredProfiles.featuredDate, today))
      .limit(1);

    if (!featured) {
      if (valkey) {
        await valkey.setex(FEATURED_CACHE_KEY, secondsUntilMidnightUtc(), 'null');
      }
      return reply.status(204).send();
    }

    // Fetch the profile
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.did, featured.did))
      .limit(1);

    if (!profile) {
      if (valkey) {
        await valkey.setex(FEATURED_CACHE_KEY, secondsUntilMidnightUtc(), 'null');
      }
      return reply.status(204).send();
    }

    // Fetch current position and external accounts in parallel
    const [profilePositions, primaryAccountResult, followersResult] = await Promise.all([
      db
        .select()
        .from(positions)
        .where(and(eq(positions.did, featured.did), eq(positions.current, true)))
        .limit(1),
      db
        .select()
        .from(externalAccounts)
        .where(and(eq(externalAccounts.did, featured.did), eq(externalAccounts.isPrimary, true)))
        .limit(1),
      db
        .select({ value: count() })
        .from(connections)
        .where(and(eq(connections.subjectDid, featured.did), eq(connections.source, 'sifa'))),
    ]);

    const currentPosition = profilePositions[0] ?? null;
    const primaryAccount = primaryAccountResult[0] ?? null;
    const followersCount = followersResult[0]?.value ?? 0;

    const resolved = resolveProfileFields(
      { headline: profile.headline, about: profile.about },
      { headline: profile.headlineOverride, about: profile.aboutOverride },
    );

    // Build location string
    const locationParts = [
      profile.locationCity,
      profile.locationRegion,
      profile.locationCountry,
    ].filter(Boolean);
    const location = locationParts.length > 0 ? locationParts.join(', ') : null;

    const response = {
      did: profile.did,
      handle: profile.handle,
      displayName: profile.displayName,
      avatar: profile.avatarUrl,
      headline: resolved.headline,
      about: resolved.about,
      currentRole: currentPosition?.title ?? null,
      currentCompany: currentPosition?.companyName ?? null,
      locationCountry: profile.locationCountry,
      locationRegion: profile.locationRegion,
      locationCity: profile.locationCity,
      countryCode: profile.countryCode,
      location,
      website: primaryAccount?.url ?? null,
      openTo: profile.openTo,
      preferredWorkplace: profile.preferredWorkplace,
      followersCount,
      claimed: true,
      featuredDate: featured.featuredDate,
    };

    if (valkey) {
      await valkey.setex(FEATURED_CACHE_KEY, secondsUntilMidnightUtc(), JSON.stringify(response));
    }

    return reply.send(response);
  });
}
