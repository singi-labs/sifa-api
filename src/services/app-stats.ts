import { eq, and, desc, notInArray } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import type { ValkeyClient } from '../cache/index.js';
import { userAppStats } from '../db/schema/user-app-stats.js';
import { suppressedDids } from '../db/schema/suppressed-dids.js';
import { scanUserApps, type AppScanResult } from './pds-scanner.js';

export interface AppStatRow {
  did: string;
  appId: string;
  isActive: boolean;
  recentCount: number;
  latestRecordAt: Date | null;
  refreshedAt: Date;
  visible: boolean;
  createdAt: Date;
}

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
const LOCK_TTL_SECONDS = 120;

export async function getAppStatsForDid(db: Database, did: string): Promise<AppStatRow[]> {
  return db
    .select()
    .from(userAppStats)
    .where(eq(userAppStats.did, did))
    .orderBy(desc(userAppStats.recentCount));
}

export async function getVisibleAppStats(db: Database, did: string): Promise<AppStatRow[]> {
  return db
    .select()
    .from(userAppStats)
    .where(and(eq(userAppStats.did, did), eq(userAppStats.visible, true)))
    .orderBy(desc(userAppStats.recentCount));
}

export async function upsertScanResults(
  db: Database,
  did: string,
  results: AppScanResult[],
): Promise<void> {
  if (results.length === 0) {
    // Delete all rows for this DID if no results
    await db.delete(userAppStats).where(eq(userAppStats.did, did));
    return;
  }

  const now = new Date();

  // Upsert each result
  for (const result of results) {
    await db
      .insert(userAppStats)
      .values({
        did,
        appId: result.appId,
        isActive: result.isActive,
        recentCount: result.recentCount,
        latestRecordAt: result.latestRecordAt,
        refreshedAt: now,
      })
      .onConflictDoUpdate({
        target: [userAppStats.did, userAppStats.appId],
        set: {
          isActive: result.isActive,
          recentCount: result.recentCount,
          latestRecordAt: result.latestRecordAt,
          refreshedAt: now,
        },
      });
  }

  // Delete rows for apps not in the results
  const resultAppIds = results.map((r) => r.appId);
  await db
    .delete(userAppStats)
    .where(and(eq(userAppStats.did, did), notInArray(userAppStats.appId, resultAppIds)));
}

function isStale(rows: AppStatRow[]): boolean {
  if (rows.length === 0) return true;

  const now = Date.now();
  return rows.every((row) => now - row.refreshedAt.getTime() >= STALE_THRESHOLD_MS);
}

export function triggerRefreshIfStale(
  db: Database,
  valkey: ValkeyClient,
  did: string,
  pdsHost: string,
): void {
  // Fire-and-forget — caller does not await
  void (async () => {
    // Check staleness
    const rows = await getAppStatsForDid(db, did);
    if (!isStale(rows)) return;

    // Acquire lock
    const lockKey = `pds-scan:${did}`;
    const locked = await valkey.set(lockKey, '1', 'EX', LOCK_TTL_SECONDS, 'NX');
    if (locked === null) return; // another scan is running

    try {
      const results = await scanUserApps(pdsHost, did);
      await upsertScanResults(db, did, results);
    } catch (err) {
      console.error(`Background PDS scan failed for ${did}:`, err);
      // Release lock early on failure
      await valkey.del(lockKey).catch(() => {});
    }
  })().catch((err) => {
    console.error(`Unexpected error in triggerRefreshIfStale for ${did}:`, err);
  });
}

export async function isDidSuppressed(db: Database, did: string): Promise<boolean> {
  const rows = await db.select().from(suppressedDids).where(eq(suppressedDids.did, did));
  return rows.length > 0;
}

export async function suppressDid(db: Database, valkey: ValkeyClient, did: string): Promise<void> {
  // Insert into suppressed list
  await db.insert(suppressedDids).values({ did }).onConflictDoNothing();

  // Delete all stats for this DID
  await db.delete(userAppStats).where(eq(userAppStats.did, did));

  // Clean up Valkey keys
  await valkey.del(`pds-scan:${did}`);
  await valkey.del(`activity-teaser:${did}`);
  const activityKeys = await valkey.keys(`activity:${did}:*`);
  if (activityKeys.length > 0) {
    await valkey.del(...activityKeys);
  }
}
