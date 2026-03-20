import type { FastifyInstance } from 'fastify';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import { Agent } from '@atproto/api';
import type { Database } from '../db/index.js';
import type { ValkeyClient } from '../cache/index.js';
import {
  resolveHandleOrDid,
  getCollectionForApp,
  extractCreatedAt,
  type ActivityItem,
} from './activity.js';
import { getVisibleAppStats, isDidSuppressed } from '../services/app-stats.js';
import { getAppsRegistry, type AppRegistryEntry } from '../lib/atproto-app-registry.js';
import { resolvePdsHost } from '../lib/pds-provider.js';

export interface HeatmapDay {
  date: string;
  total: number;
  apps: { appId: string; count: number }[];
}

export interface HeatmapResponse {
  days: HeatmapDay[];
  appTotals: { appId: string; appName: string; total: number }[];
  thresholds: [number, number, number, number];
}

const publicBskyAgent = new Agent('https://public.api.bsky.app');

/**
 * Compute quantile-based thresholds [25th, 50th, 75th, 90th] from non-zero day counts.
 * Returns [1,2,3,4] when there are no non-zero values.
 */
export function computeThresholds(dayCounts: number[]): [number, number, number, number] {
  const nonZero = dayCounts.filter((c) => c > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) return [1, 2, 3, 4];

  const quantile = (sorted: number[], q: number): number => {
    const pos = q * (sorted.length - 1);
    const lower = Math.floor(pos);
    const upper = Math.ceil(pos);
    if (lower === upper) return sorted[lower]!;
    const weight = pos - lower;
    return Math.round(sorted[lower]! * (1 - weight) + sorted[upper]! * weight);
  };

  return [
    Math.max(1, quantile(nonZero, 0.25)),
    Math.max(1, quantile(nonZero, 0.5)),
    Math.max(1, quantile(nonZero, 0.75)),
    Math.max(1, quantile(nonZero, 0.9)),
  ];
}

/**
 * Group activity items by date (YYYY-MM-DD) and count per app.
 * Apps sorted descending by count within each day; days sorted ascending by date.
 */
export function aggregateByDay(items: ActivityItem[]): HeatmapDay[] {
  const dayMap = new Map<string, Map<string, number>>();

  for (const item of items) {
    const createdAt = extractCreatedAt(item.record);
    const date = createdAt.slice(0, 10); // YYYY-MM-DD
    let appMap = dayMap.get(date);
    if (!appMap) {
      appMap = new Map<string, number>();
      dayMap.set(date, appMap);
    }
    appMap.set(item.appId, (appMap.get(item.appId) ?? 0) + 1);
  }

  const days: HeatmapDay[] = [];
  for (const [date, appMap] of dayMap) {
    const apps = [...appMap.entries()]
      .map(([appId, count]) => ({ appId, count }))
      .sort((a, b) => b.count - a.count);
    const total = apps.reduce((sum, a) => sum + a.count, 0);
    days.push({ date, total, apps });
  }

  days.sort((a, b) => a.date.localeCompare(b.date));
  return days;
}

/**
 * Fetch all Bluesky posts for a DID since a given date, paging through getAuthorFeed.
 */
async function fetchAllBlueskyItems(
  did: string,
  since: Date,
  maxPages: number,
): Promise<ActivityItem[]> {
  const allItems: ActivityItem[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const params: { actor: string; limit: number; cursor?: string } = {
      actor: did,
      limit: 100,
    };
    if (cursor) params.cursor = cursor;

    const res = await publicBskyAgent.app.bsky.feed.getAuthorFeed(params, {
      signal: AbortSignal.timeout(5000),
    });

    let reachedEnd = false;
    for (const feedItem of res.data.feed) {
      if (feedItem.post.author.did !== did) continue; // skip reposts
      const indexedAt = feedItem.post.indexedAt;
      if (new Date(indexedAt) < since) {
        reachedEnd = true;
        break;
      }
      allItems.push({
        uri: feedItem.post.uri,
        collection: 'app.bsky.feed.post',
        rkey: feedItem.post.uri.split('/').pop() ?? '',
        record: feedItem.post.record,
        appId: 'bluesky',
        appName: 'Bluesky',
        category: 'Posts',
        indexedAt,
      });
    }

    if (reachedEnd || !res.data.cursor || res.data.feed.length < 100) break;
    cursor = res.data.cursor;
  }

  return allItems;
}

/**
 * Fetch all PDS records for a given collection since a given date.
 */
async function fetchAllPdsItems(
  pdsHost: string,
  did: string,
  collection: string,
  entry: AppRegistryEntry,
  since: Date,
  maxPages: number,
): Promise<ActivityItem[]> {
  const agent = new Agent(`https://${pdsHost}`);
  const allItems: ActivityItem[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const params: { repo: string; collection: string; limit: number; cursor?: string } = {
      repo: did,
      collection,
      limit: 100,
    };
    if (cursor) params.cursor = cursor;

    const res = await agent.com.atproto.repo.listRecords(params, {
      signal: AbortSignal.timeout(5000),
    });

    for (const rec of res.data.records) {
      const createdAt = extractCreatedAt(rec.value);
      if (new Date(createdAt) < since) continue; // skip older records
      allItems.push({
        uri: rec.uri,
        collection,
        rkey: rec.uri.split('/').pop() ?? '',
        record: rec.value,
        appId: entry.id,
        appName: entry.name,
        category: entry.category,
        indexedAt: createdAt,
      });
    }

    if (!res.data.cursor || res.data.records.length < 100) break;
    cursor = res.data.cursor;
  }

  return allItems;
}

export function registerHeatmapRoutes(
  app: FastifyInstance,
  db: Database,
  oauthClient: NodeOAuthClient | null,
  valkey: ValkeyClient | null = null,
) {
  // Suppress unused parameter warning -- oauthClient reserved for future auth-gated features
  void oauthClient;

  app.get<{
    Params: { handleOrDid: string };
    Querystring: { days?: string };
  }>('/api/activity/:handleOrDid/heatmap', async (request, reply) => {
    const { handleOrDid } = request.params;
    const daysParam = Math.min(Math.max(parseInt(request.query.days ?? '180', 10) || 180, 1), 730);

    const did = await resolveHandleOrDid(db, handleOrDid);
    if (!did) {
      return reply.status(404).send({ error: 'NotFound', message: 'User not found' });
    }

    const suppressed = await isDidSuppressed(db, did);
    if (suppressed) {
      return reply.send({ days: [], appTotals: [], thresholds: [1, 2, 3, 4] });
    }

    // Check Valkey cache
    const cacheKey = `heatmap:${did}:${daysParam}`;
    if (valkey) {
      try {
        const cached = await valkey.get(cacheKey);
        if (cached !== null) {
          return reply.send(JSON.parse(cached));
        }
      } catch (err) {
        request.log.warn({ err, cacheKey }, 'valkey.get failed for heatmap');
      }
    }

    const stats = await getVisibleAppStats(db, did);
    const registry = getAppsRegistry();
    const since = new Date(Date.now() - daysParam * 24 * 60 * 60 * 1000);
    const maxPages = 5;

    const pdsHost = await resolvePdsHost(did);

    // Build fetch promises for all visible apps
    const fetchPromises = stats.map((stat) => {
      const entry = registry.find((e) => e.id === stat.appId);
      if (!entry) return Promise.resolve([] as ActivityItem[]);

      if (entry.id === 'bluesky') {
        return fetchAllBlueskyItems(did, since, maxPages).catch((err: unknown) => {
          request.log.warn({ err, appId: entry.id }, 'Failed to fetch Bluesky items for heatmap');
          return [] as ActivityItem[];
        });
      }

      if (!pdsHost) return Promise.resolve([] as ActivityItem[]);
      const collection = getCollectionForApp(entry);
      return fetchAllPdsItems(pdsHost, did, collection, entry, since, maxPages).catch(
        (err: unknown) => {
          request.log.warn({ err, appId: entry.id }, 'Failed to fetch PDS items for heatmap');
          return [] as ActivityItem[];
        },
      );
    });

    const results = await Promise.allSettled(fetchPromises);
    const allItems: ActivityItem[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
      }
    }

    const days = aggregateByDay(allItems);
    const thresholds = computeThresholds(days.map((d) => d.total));

    // Compute appTotals across all days
    const appTotalMap = new Map<string, { appName: string; total: number }>();
    for (const item of allItems) {
      const existing = appTotalMap.get(item.appId);
      if (existing) {
        existing.total += 1;
      } else {
        appTotalMap.set(item.appId, { appName: item.appName, total: 1 });
      }
    }
    const appTotals = [...appTotalMap.entries()]
      .map(([appId, { appName, total }]) => ({ appId, appName, total }))
      .sort((a, b) => b.total - a.total);

    const responseBody: HeatmapResponse = { days, appTotals, thresholds };

    // Cache result for 4 hours
    if (valkey) {
      try {
        await valkey.set(cacheKey, JSON.stringify(responseBody), 'EX', 14400);
      } catch (err) {
        request.log.warn({ err, cacheKey }, 'valkey.set failed for heatmap');
      }
    }

    return reply.send(responseBody);
  });
}
