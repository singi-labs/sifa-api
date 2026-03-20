import { Agent } from '@atproto/api';
import { getAppsRegistry, EXCLUDED_COLLECTIONS } from '../lib/atproto-app-registry.js';

export interface AppScanResult {
  appId: string;
  isActive: boolean;
  recentCount: number;
  latestRecordAt: Date | null;
}

const MAX_PAGES = 5;
const PAGE_LIMIT = 100;
const RECENT_WINDOW_DAYS = 90;
const REQUEST_TIMEOUT_MS = 5000;

function getRecentWindowStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() - RECENT_WINDOW_DAYS);
  return d;
}

function getCollectionsForApp(app: {
  scanCollections: string[];
  collectionPrefixes: string[];
}): string[] {
  const collections =
    app.scanCollections.length > 0
      ? [...app.scanCollections]
      : app.collectionPrefixes.length > 0
        ? [app.collectionPrefixes[0]!]
        : [];

  return collections.filter((c) => !EXCLUDED_COLLECTIONS.includes(c));
}

interface RecordValue {
  createdAt?: string;
}

async function scanCollection(
  agent: Agent,
  did: string,
  collection: string,
): Promise<{ recentCount: number; latestRecordAt: Date | null }> {
  const windowStart = getRecentWindowStart();
  let recentCount = 0;
  let latestRecordAt: Date | null = null;
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await agent.com.atproto.repo.listRecords(
      {
        repo: did,
        collection,
        limit: PAGE_LIMIT,
        cursor,
      },
      { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
    );

    const records = res.data.records;
    if (records.length === 0) break;

    let allOutsideWindow = true;

    for (const record of records) {
      const val = record.value as RecordValue;
      if (!val.createdAt) continue;

      const recordDate = new Date(val.createdAt);

      if (latestRecordAt === null || recordDate > latestRecordAt) {
        latestRecordAt = recordDate;
      }

      if (recordDate >= windowStart) {
        recentCount++;
        allOutsideWindow = false;
      }
    }

    if (allOutsideWindow) break;

    cursor = res.data.cursor;
    if (!cursor) break;
  }

  return { recentCount, latestRecordAt };
}

async function scanApp(
  agent: Agent,
  did: string,
  appId: string,
  collections: string[],
): Promise<AppScanResult> {
  if (collections.length === 0) {
    return { appId, isActive: false, recentCount: 0, latestRecordAt: null };
  }

  const collectionResults = await Promise.allSettled(
    collections.map((c) => scanCollection(agent, did, c)),
  );

  let totalRecentCount = 0;
  let overallLatest: Date | null = null;

  for (const result of collectionResults) {
    if (result.status !== 'fulfilled') continue;
    totalRecentCount += result.value.recentCount;
    if (
      result.value.latestRecordAt !== null &&
      (overallLatest === null || result.value.latestRecordAt > overallLatest)
    ) {
      overallLatest = result.value.latestRecordAt;
    }
  }

  return {
    appId,
    isActive: totalRecentCount > 0,
    recentCount: totalRecentCount,
    latestRecordAt: overallLatest,
  };
}

export async function scanUserApps(pdsUrl: string, did: string): Promise<AppScanResult[]> {
  const agent = new Agent(pdsUrl);
  const registry = getAppsRegistry();

  const scanPromises = registry.map((app) => {
    const collections = getCollectionsForApp(app);
    return scanApp(agent, did, app.id, collections);
  });

  const results = await Promise.allSettled(scanPromises);

  return results.map((result, i) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      appId: registry[i]!.id,
      isActive: false,
      recentCount: 0,
      latestRecordAt: null,
    };
  });
}
