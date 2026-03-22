import type { FastifyInstance } from 'fastify';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import { Agent } from '@atproto/api';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import type { ValkeyClient } from '../cache/index.js';
import { userAppStats } from '../db/schema/user-app-stats.js';
import { profiles } from '../db/schema/index.js';
import { createAuthMiddleware, getAuthContext } from '../middleware/auth.js';
import { getVisibleAppStats, isDidSuppressed, suppressDid } from '../services/app-stats.js';
import { getAppsRegistry, type AppRegistryEntry } from '../lib/atproto-app-registry.js';
import { resolvePdsHost } from '../lib/pds-provider.js';

const publicBskyAgent = new Agent('https://public.api.bsky.app');

const visibilitySchema = z.object({
  appId: z.string().min(1).max(200),
  visible: z.boolean(),
});

const suppressSchema = z.object({
  handleOrDid: z.string().min(1).max(500),
});

export interface ActivityItem {
  uri: string;
  collection: string;
  rkey: string;
  record: unknown;
  appId: string;
  appName: string;
  category: string;
  indexedAt: string;
}

interface CompositeCursor {
  cursors: Record<string, string>;
}

/**
 * Resolve a handle-or-DID string to a DID.
 * Checks the local profiles table first, then falls back to Bluesky public API.
 */
export async function resolveHandleOrDid(
  db: Database,
  handleOrDid: string,
): Promise<string | null> {
  const isDid = handleOrDid.startsWith('did:');
  const normalized = isDid ? handleOrDid : handleOrDid.toLowerCase();
  const condition = isDid ? eq(profiles.did, normalized) : eq(profiles.handle, normalized);

  const [profile] = await db.select().from(profiles).where(condition).limit(1);
  if (profile) return profile.did;

  // Fall back to Bluesky public API resolution
  try {
    const res = await publicBskyAgent.resolveHandle(
      { handle: normalized },
      { signal: AbortSignal.timeout(3000) },
    );
    return res.data.did;
  } catch {
    return isDid ? normalized : null;
  }
}

/**
 * Determine which collection to fetch for a given registry entry.
 */
export function getCollectionForApp(entry: AppRegistryEntry): string {
  if (entry.scanCollections.length > 0) {
    return entry.scanCollections[0] ?? entry.collectionPrefixes[0] ?? '';
  }
  return entry.collectionPrefixes[0] ?? '';
}

/**
 * Extract createdAt from a record, falling back to current time.
 */
export function extractCreatedAt(record: unknown): string {
  if (
    record !== null &&
    typeof record === 'object' &&
    'createdAt' in record &&
    typeof (record as Record<string, unknown>).createdAt === 'string'
  ) {
    return (record as Record<string, unknown>).createdAt as string;
  }
  return new Date().toISOString();
}

/**
 * Extract rkey from an AT URI (at://did/collection/rkey).
 */
export function extractRkey(uri: string): string {
  const parts = uri.split('/');
  return parts[parts.length - 1] ?? '';
}

export interface EventMeta {
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  mode: string | null;
  locationName: string | null;
  locationLocality: string | null;
  locationCountry: string | null;
}

/**
 * Parse an AT URI (at://did/collection/rkey) into its components.
 */
function parseAtUri(uri: string): { did: string; collection: string; rkey: string } | null {
  const match = /^at:\/\/(did:[^/]+)\/([^/]+)\/([^/]+)$/.exec(uri);
  if (!match || !match[1] || !match[2] || !match[3]) return null;
  return { did: match[1], collection: match[2], rkey: match[3] };
}

/**
 * Fetch an event record from the creator's PDS.
 * This is the production implementation used when no mock is injected.
 */
async function fetchEventFromPds(uri: string): Promise<EventMeta | null> {
  const parsed = parseAtUri(uri);
  if (!parsed) return null;

  try {
    const pdsHost = await resolvePdsHost(parsed.did);
    if (!pdsHost) return null;

    const agent = new Agent(`https://${pdsHost}`);
    const res = await agent.com.atproto.repo.getRecord(
      { repo: parsed.did, collection: parsed.collection, rkey: parsed.rkey },
      { signal: AbortSignal.timeout(3000) },
    );

    const record = res.data.value as Record<string, unknown>;
    const locations = Array.isArray(record.locations) ? record.locations : [];
    const firstLocation = (locations[0] ?? {}) as Record<string, unknown>;

    return {
      name: typeof record.name === 'string' ? record.name : '',
      startsAt: typeof record.startsAt === 'string' ? record.startsAt : null,
      endsAt: typeof record.endsAt === 'string' ? record.endsAt : null,
      mode: typeof record.mode === 'string' ? record.mode : null,
      locationName: typeof firstLocation.name === 'string' ? firstLocation.name : null,
      locationLocality: typeof firstLocation.locality === 'string' ? firstLocation.locality : null,
      locationCountry: typeof firstLocation.country === 'string' ? firstLocation.country : null,
    };
  } catch {
    return null;
  }
}

/**
 * Enrich RSVP activity items with event metadata from the referenced event record.
 * Non-RSVP items pass through unchanged. Failed fetches leave items unchanged.
 * Accepts an optional fetchEvent function for dependency injection in tests.
 */
export async function enrichRsvpItems(
  items: ActivityItem[],
  valkey: ValkeyClient | null,
  fetchEvent?: (uri: string) => Promise<EventMeta | null>,
): Promise<ActivityItem[]> {
  const fetcher = fetchEvent ?? fetchEventFromPds;

  const enrichPromises = items.map(async (item) => {
    if (item.collection !== 'community.lexicon.calendar.rsvp') {
      return item;
    }

    const record = item.record as Record<string, unknown> | null;
    const subject = record?.subject as { uri?: string } | undefined;
    const eventUri = subject?.uri;
    if (!eventUri) return item;

    // Check Valkey cache
    const cacheKey = `event-meta:${eventUri}`;
    if (valkey) {
      try {
        const cached = await valkey.get(cacheKey);
        if (cached !== null) {
          const eventMeta = JSON.parse(cached) as EventMeta;
          return { ...item, record: { ...record, eventMeta } };
        }
      } catch {
        // Cache miss or error -- fall through to fetch
      }
    }

    const eventMeta = await fetcher(eventUri);
    if (!eventMeta) return item;

    // Cache for 1 hour
    if (valkey) {
      try {
        await valkey.set(cacheKey, JSON.stringify(eventMeta), 'EX', 3600);
      } catch {
        // Cache write failure is non-critical
      }
    }

    return { ...item, record: { ...record, eventMeta } };
  });

  return Promise.all(enrichPromises);
}

/**
 * Merge resolved embed (with thumb URLs) from the Bluesky AppView into
 * the raw record. The raw record only has blob refs for images; the
 * AppView response includes resolved CDN URLs in item.post.embed.
 */
function mergeResolvedEmbed(record: unknown, embed: unknown): unknown {
  if (!embed || typeof record !== 'object' || record === null) return record;
  return { ...(record as Record<string, unknown>), embed };
}

/**
 * Fetch recent items from Bluesky via the public AppView API.
 */
async function fetchBlueskyItems(did: string, limit: number): Promise<ActivityItem[]> {
  const res = await publicBskyAgent.app.bsky.feed.getAuthorFeed(
    { actor: did, limit },
    { signal: AbortSignal.timeout(3000) },
  );

  return res.data.feed
    .filter((item) => item.post.author.did === did) // exclude reposts from others
    .map((item) => ({
      uri: item.post.uri,
      collection: 'app.bsky.feed.post',
      rkey: extractRkey(item.post.uri),
      record: mergeResolvedEmbed(item.post.record, item.post.embed),
      appId: 'bluesky',
      appName: 'Bluesky',
      category: 'Posts',
      indexedAt: item.post.indexedAt,
    }));
}

/**
 * Fetch recent items from a PDS via listRecords.
 */
async function fetchPdsItems(
  pdsHost: string,
  did: string,
  collection: string,
  entry: AppRegistryEntry,
  limit: number,
  cursor?: string,
): Promise<{ items: ActivityItem[]; cursor: string | undefined }> {
  const agent = new Agent(`https://${pdsHost}`);
  const params: Record<string, unknown> = {
    repo: did,
    collection,
    limit,
  };
  if (cursor) {
    params.cursor = cursor;
  }

  const res = await agent.com.atproto.repo.listRecords(
    params as { repo: string; collection: string; limit: number; cursor?: string },
    { signal: AbortSignal.timeout(3000) },
  );

  const items: ActivityItem[] = res.data.records.map((rec) => ({
    uri: rec.uri,
    collection,
    rkey: extractRkey(rec.uri),
    record: rec.value,
    appId: entry.id,
    appName: entry.name,
    category: entry.category,
    indexedAt: extractCreatedAt(rec.value),
  }));

  return { items, cursor: res.data.cursor };
}

/**
 * Fetch Bluesky feed with cursor support for paginated endpoint.
 */
async function fetchBlueskyFeedPaginated(
  did: string,
  limit: number,
  cursor?: string,
): Promise<{ items: ActivityItem[]; cursor: string | undefined }> {
  const params: { actor: string; limit: number; cursor?: string } = { actor: did, limit };
  if (cursor) {
    params.cursor = cursor;
  }

  const res = await publicBskyAgent.app.bsky.feed.getAuthorFeed(params, {
    signal: AbortSignal.timeout(3000),
  });

  const items: ActivityItem[] = res.data.feed
    .filter((item) => item.post.author.did === did)
    .map((item) => ({
      uri: item.post.uri,
      collection: 'app.bsky.feed.post',
      rkey: extractRkey(item.post.uri),
      record: mergeResolvedEmbed(item.post.record, item.post.embed),
      appId: 'bluesky',
      appName: 'Bluesky',
      category: 'Posts',
      indexedAt: item.post.indexedAt,
    }));

  return { items, cursor: res.data.cursor };
}

export function registerActivityRoutes(
  app: FastifyInstance,
  db: Database,
  oauthClient: NodeOAuthClient | null,
  valkey: ValkeyClient | null = null,
) {
  const requireAuth = createAuthMiddleware(oauthClient, db);

  // PUT /api/profile/activity-visibility -- toggle visibility of a specific app's activity
  app.put(
    '/api/profile/activity-visibility',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = visibilitySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'ValidationError', issues: parsed.error.issues });
      }

      const { did } = getAuthContext(request);
      const { appId, visible } = parsed.data;

      const result = await db
        .update(userAppStats)
        .set({ visible })
        .where(and(eq(userAppStats.did, did), eq(userAppStats.appId, appId)));

      if (result.rowCount === 0) {
        return reply.status(404).send({
          error: 'NotFound',
          message: `No activity stats found for app: ${appId}`,
        });
      }

      return reply.status(200).send({ ok: true });
    },
  );

  // GET /api/activity/:handleOrDid/teaser -- 3-5 recent items for profile activity card
  app.get<{ Params: { handleOrDid: string } }>(
    '/api/activity/:handleOrDid/teaser',
    async (request, reply) => {
      const { handleOrDid } = request.params;

      const did = await resolveHandleOrDid(db, handleOrDid);
      if (!did) {
        return reply.status(404).send({ error: 'NotFound', message: 'User not found' });
      }

      const suppressed = await isDidSuppressed(db, did);
      if (suppressed) {
        return reply.send({ items: [] });
      }

      const stats = await getVisibleAppStats(db, did);
      // Only consider apps that actually have activity
      const activeApps = stats.filter((s) => s.isActive && s.recentCount > 0);
      const topApps = activeApps.slice(0, 3);

      if (topApps.length === 0) {
        return reply.send({ items: [] });
      }

      // Check Valkey cache
      const cacheKey = `activity-teaser:${did}`;
      if (valkey) {
        try {
          const cached = await valkey.get(cacheKey);
          if (cached !== null) {
            return reply.send(JSON.parse(cached));
          }
        } catch (err) {
          request.log.warn({ err, cacheKey }, 'valkey.get failed for activity teaser');
        }
      }

      const pdsHost = await resolvePdsHost(did);
      const registry = getAppsRegistry();

      // Distribute per-app limit: 5 items total, spread across active apps
      const perAppLimit = Math.min(5, Math.ceil(5 / topApps.length));

      // Build fetch promises for each top app
      const fetchPromises = topApps.map((stat) => {
        const entry = registry.find((e) => e.id === stat.appId);
        if (!entry) return Promise.resolve([]);

        if (entry.id === 'bluesky') {
          return fetchBlueskyItems(did, perAppLimit);
        }

        if (!pdsHost) return Promise.resolve([]);
        const collection = getCollectionForApp(entry);
        return fetchPdsItems(pdsHost, did, collection, entry, perAppLimit).then((r) => r.items);
      });

      const results = await Promise.allSettled(fetchPromises);

      const allItems: ActivityItem[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
          allItems.push(...result.value.slice(0, perAppLimit));
        }
      }

      // Sort by date descending, take up to 5
      allItems.sort((a, b) => new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime());
      const items = allItems.slice(0, 5);
      const enrichedItems = await enrichRsvpItems(items, valkey);

      const responseBody = { items: enrichedItems };

      // Only cache non-empty results — empty may be a transient fetch failure
      if (valkey && items.length > 0) {
        try {
          await valkey.set(cacheKey, JSON.stringify(responseBody), 'EX', 900);
        } catch (err) {
          request.log.warn({ err, cacheKey }, 'valkey.set failed for activity teaser');
        }
      }

      return reply.send(responseBody);
    },
  );

  // GET /api/activity/:handleOrDid -- full paginated activity feed
  app.get<{
    Params: { handleOrDid: string };
    Querystring: { category?: string; limit?: string; cursor?: string };
  }>('/api/activity/:handleOrDid', async (request, reply) => {
    const { handleOrDid } = request.params;
    const categoryParam = request.query.category ?? 'all';
    const limitParam = Math.min(Math.max(parseInt(request.query.limit ?? '20', 10) || 20, 1), 50);
    const cursorParam = request.query.cursor ?? null;

    const did = await resolveHandleOrDid(db, handleOrDid);
    if (!did) {
      return reply.status(404).send({ error: 'NotFound', message: 'User not found' });
    }

    const suppressed = await isDidSuppressed(db, did);
    if (suppressed) {
      return reply.send({ items: [], cursor: null, hasMore: false });
    }

    const stats = await getVisibleAppStats(db, did);
    const registry = getAppsRegistry();

    // Compute available categories from apps that actually have recent content
    const availableCategories = [
      ...new Set(
        stats
          .filter((s) => s.recentCount > 0)
          .map((s) => registry.find((e) => e.id === s.appId)?.category)
          .filter((c): c is string => c !== undefined),
      ),
    ];
    // Filter apps by category if specified, skipping apps with no recent content
    const activeStats = stats.filter((s) => s.recentCount > 0);
    let targetApps: { stat: (typeof stats)[number]; entry: AppRegistryEntry }[];
    if (categoryParam === 'all') {
      targetApps = activeStats
        .slice(0, 5)
        .map((stat) => {
          const entry = registry.find((e) => e.id === stat.appId);
          return entry ? { stat, entry } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    } else {
      targetApps = activeStats
        .map((stat) => {
          const entry = registry.find((e) => e.id === stat.appId);
          return entry && entry.category === categoryParam ? { stat, entry } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    }

    if (targetApps.length === 0) {
      return reply.send({ items: [], cursor: null, hasMore: false });
    }

    // Decode composite cursor
    let perCollectionCursors: Record<string, string> = {};
    if (cursorParam) {
      try {
        const decoded = JSON.parse(
          Buffer.from(cursorParam, 'base64url').toString('utf-8'),
        ) as CompositeCursor;
        perCollectionCursors = decoded.cursors;
      } catch {
        return reply.status(400).send({ error: 'BadRequest', message: 'Invalid cursor' });
      }
    }

    const pdsHost = await resolvePdsHost(did);

    // Per-app limit: fetch a bit more per source to allow merge-sorting
    const perAppLimit = Math.min(limitParam, 20);

    // Build fetch promises
    const fetchPromises = targetApps.map(({ entry }) => {
      const collection = getCollectionForApp(entry);
      const collectionCursor = perCollectionCursors[collection] ?? undefined;

      // Check Valkey cache for this collection+cursor combo
      const collCacheKey = `activity:${did}:${collection}:${collectionCursor ?? 'start'}`;

      const fetchFn = async (): Promise<{
        items: ActivityItem[];
        cursor: string | undefined;
        collection: string;
      }> => {
        // Try cache first
        if (valkey) {
          try {
            const cached = await valkey.get(collCacheKey);
            if (cached !== null) {
              return JSON.parse(cached) as {
                items: ActivityItem[];
                cursor: string | undefined;
                collection: string;
              };
            }
          } catch (err) {
            request.log.warn({ err, collCacheKey }, 'valkey.get failed for activity feed');
          }
        }

        let result: { items: ActivityItem[]; cursor: string | undefined };

        if (entry.id === 'bluesky') {
          result = await fetchBlueskyFeedPaginated(did, perAppLimit, collectionCursor);
        } else if (pdsHost) {
          result = await fetchPdsItems(
            pdsHost,
            did,
            collection,
            entry,
            perAppLimit,
            collectionCursor,
          );
        } else {
          result = { items: [], cursor: undefined };
        }

        const cacheValue = { ...result, collection };

        // Cache the result
        if (valkey) {
          try {
            await valkey.set(collCacheKey, JSON.stringify(cacheValue), 'EX', 300);
          } catch (err) {
            request.log.warn({ err, collCacheKey }, 'valkey.set failed for activity feed');
          }
        }

        return cacheValue;
      };

      return fetchFn();
    });

    const results = await Promise.allSettled(fetchPromises);

    // Merge all items and build new composite cursor
    const allItems: ActivityItem[] = [];
    const newCursors: Record<string, string> = {};

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value.items);
        // Only keep cursor if source returned a full page (likely has more)
        if (result.value.cursor && result.value.items.length >= perAppLimit) {
          newCursors[result.value.collection] = result.value.cursor;
        }
      }
    }

    // Sort by date descending
    allItems.sort((a, b) => new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime());

    // Paginate
    const items = allItems.slice(0, limitParam);
    const enrichedItems = await enrichRsvpItems(items, valkey);
    const hasMore = Object.keys(newCursors).length > 0;

    const compositeCursor = hasMore
      ? Buffer.from(JSON.stringify({ cursors: newCursors }), 'utf-8').toString('base64url')
      : null;

    return reply.send({
      items: enrichedItems,
      cursor: compositeCursor,
      hasMore,
      availableCategories,
    });
  });

  // POST /api/privacy/suppress -- GDPR erasure endpoint (no auth required)
  app.post('/api/privacy/suppress', async (request, reply) => {
    const parsed = suppressSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationError', issues: parsed.error.issues });
    }

    const did = await resolveHandleOrDid(db, parsed.data.handleOrDid);
    if (!did) {
      return reply.status(404).send({ error: 'NotFound', message: 'User not found' });
    }

    if (!valkey) {
      return reply
        .status(503)
        .send({ error: 'ServiceUnavailable', message: 'Cache not available' });
    }

    await suppressDid(db, valkey, did);

    return reply.send({ ok: true });
  });
}
