import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pds-scanner
const mockScanUserApps = vi.fn();
vi.mock('../../src/services/pds-scanner.js', () => ({
  scanUserApps: mockScanUserApps,
}));

// Mock drizzle-orm operators — return tagged objects so we can assert calls
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ _op: 'eq', col, val })),
  and: vi.fn((...args: unknown[]) => ({ _op: 'and', args })),
  desc: vi.fn((col) => ({ _op: 'desc', col })),
  lt: vi.fn((col, val) => ({ _op: 'lt', col, val })),
  notInArray: vi.fn((col, vals) => ({ _op: 'notInArray', col, vals })),
}));

import type { AppScanResult } from '../../src/services/pds-scanner.js';
import type { AppStatRow } from '../../src/services/app-stats.js';

// ---- Mock DB builder ----
function createMockDb() {
  const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
  const mockDeleteObj = { where: mockDeleteWhere };
  const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const mockOnConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  const mockInsertValues = vi.fn().mockReturnValue({
    onConflictDoUpdate: mockOnConflictDoUpdate,
    onConflictDoNothing: mockOnConflictDoNothing,
  });
  const mockSelectWhere = vi.fn().mockReturnValue({
    orderBy: vi.fn().mockResolvedValue([]),
  });
  const mockSelectFrom = vi.fn().mockReturnValue({
    where: mockSelectWhere,
  });

  const db = {
    select: vi.fn().mockReturnValue({ from: mockSelectFrom }),
    insert: vi.fn().mockReturnValue({ values: mockInsertValues }),
    delete: vi.fn().mockReturnValue(mockDeleteObj),
    _mocks: {
      selectFrom: mockSelectFrom,
      selectWhere: mockSelectWhere,
      insertValues: mockInsertValues,
      onConflictDoUpdate: mockOnConflictDoUpdate,
      onConflictDoNothing: mockOnConflictDoNothing,
      deleteObj: mockDeleteObj,
      deleteWhere: mockDeleteWhere,
    },
  } as unknown;

  return db as ReturnType<typeof createMockDb> & {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    _mocks: {
      selectFrom: ReturnType<typeof vi.fn>;
      selectWhere: ReturnType<typeof vi.fn>;
      insertValues: ReturnType<typeof vi.fn>;
      onConflictDoUpdate: ReturnType<typeof vi.fn>;
      onConflictDoNothing: ReturnType<typeof vi.fn>;
      deleteObj: { where: ReturnType<typeof vi.fn> };
      deleteWhere: ReturnType<typeof vi.fn>;
    };
  };
}

// ---- Mock Valkey ----
function createMockValkey() {
  return {
    set: vi.fn(),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
  } as unknown as ReturnType<typeof createMockValkey> & {
    set: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    keys: ReturnType<typeof vi.fn>;
  };
}

describe('app-stats service', () => {
  let db: ReturnType<typeof createMockDb>;
  let valkey: ReturnType<typeof createMockValkey>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    db = createMockDb();
    valkey = createMockValkey();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // We import dynamically after mocks are set up
  async function getModule() {
    return import('../../src/services/app-stats.js');
  }

  describe('getVisibleAppStats', () => {
    it('returns only visible rows ordered by recentCount DESC', async () => {
      const { getVisibleAppStats } = await getModule();

      const visibleRows: AppStatRow[] = [
        {
          did: 'did:plc:test',
          appId: 'bluesky',
          isActive: true,
          recentCount: 42,
          latestRecordAt: new Date(),
          refreshedAt: new Date(),
          visible: true,
          createdAt: new Date(),
        },
        {
          did: 'did:plc:test',
          appId: 'whitewind',
          isActive: true,
          recentCount: 5,
          latestRecordAt: new Date(),
          refreshedAt: new Date(),
          visible: true,
          createdAt: new Date(),
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(visibleRows);
      db._mocks.selectWhere.mockReturnValue({ orderBy: mockOrderBy });

      const result = await getVisibleAppStats(db as never, 'did:plc:test');

      expect(result).toEqual(visibleRows);
      expect(result[0]?.recentCount).toBeGreaterThan(result[1]?.recentCount ?? 0);
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('upsertScanResults', () => {
    it('calls Drizzle upsert for each scan result', async () => {
      const { upsertScanResults } = await getModule();

      const results: AppScanResult[] = [
        { appId: 'bluesky', isActive: true, recentCount: 10, latestRecordAt: new Date() },
        { appId: 'whitewind', isActive: false, recentCount: 0, latestRecordAt: null },
      ];

      await upsertScanResults(db as never, 'did:plc:test', results);

      // Should have called insert for the batch
      expect(db.insert).toHaveBeenCalled();
      expect(db._mocks.insertValues).toHaveBeenCalled();
      expect(db._mocks.onConflictDoUpdate).toHaveBeenCalled();
    });
  });

  describe('triggerRefreshIfStale', () => {
    it('acquires Valkey lock before scanning', async () => {
      const { triggerRefreshIfStale } = await getModule();

      // No rows exist — stale
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      db._mocks.selectWhere.mockReturnValue({ orderBy: mockOrderBy });

      // Lock acquired
      valkey.set.mockResolvedValue('OK');
      mockScanUserApps.mockResolvedValue([]);

      triggerRefreshIfStale(
        db as never,
        valkey as never,
        'did:plc:test',
        'https://pds.example.com',
      );

      // Let the microtask queue flush
      await vi.advanceTimersByTimeAsync(0);

      expect(valkey.set).toHaveBeenCalledWith(
        'pds-scan:did:plc:test',
        expect.any(String),
        'EX',
        120,
        'NX',
      );
      expect(mockScanUserApps).toHaveBeenCalledWith('https://pds.example.com', 'did:plc:test');
    });

    it('skips if lock already held', async () => {
      const { triggerRefreshIfStale } = await getModule();

      // No rows — stale
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      db._mocks.selectWhere.mockReturnValue({ orderBy: mockOrderBy });

      // Lock NOT acquired
      valkey.set.mockResolvedValue(null);

      triggerRefreshIfStale(
        db as never,
        valkey as never,
        'did:plc:test',
        'https://pds.example.com',
      );

      await vi.advanceTimersByTimeAsync(0);

      expect(valkey.set).toHaveBeenCalled();
      expect(mockScanUserApps).not.toHaveBeenCalled();
    });

    it('skips if data is fresh (refreshedAt < 24h old)', async () => {
      const { triggerRefreshIfStale } = await getModule();

      const freshRow: AppStatRow = {
        did: 'did:plc:test',
        appId: 'bluesky',
        isActive: true,
        recentCount: 10,
        latestRecordAt: new Date(),
        refreshedAt: new Date(), // just now — fresh
        visible: true,
        createdAt: new Date(),
      };

      const mockOrderBy = vi.fn().mockResolvedValue([freshRow]);
      db._mocks.selectWhere.mockReturnValue({ orderBy: mockOrderBy });

      triggerRefreshIfStale(
        db as never,
        valkey as never,
        'did:plc:test',
        'https://pds.example.com',
      );

      await vi.advanceTimersByTimeAsync(0);

      expect(valkey.set).not.toHaveBeenCalled();
      expect(mockScanUserApps).not.toHaveBeenCalled();
    });
  });

  describe('isDidSuppressed', () => {
    it('returns true when DID exists in suppressed table', async () => {
      const { isDidSuppressed } = await getModule();

      const mockOrderBy = vi.fn().mockResolvedValue([{ did: 'did:plc:bad' }]);
      db._mocks.selectWhere.mockReturnValue({ orderBy: mockOrderBy });
      // For suppressedDids, we use a simpler select pattern
      db._mocks.selectWhere.mockResolvedValue([{ did: 'did:plc:bad' }]);

      const result = await isDidSuppressed(db as never, 'did:plc:bad');
      expect(result).toBe(true);
    });

    it('returns false when DID is not suppressed', async () => {
      const { isDidSuppressed } = await getModule();

      db._mocks.selectWhere.mockResolvedValue([]);

      const result = await isDidSuppressed(db as never, 'did:plc:good');
      expect(result).toBe(false);
    });
  });

  describe('suppressDid', () => {
    it('inserts suppression, deletes stats, and clears Valkey keys', async () => {
      const { suppressDid } = await getModule();

      valkey.keys.mockResolvedValue(['activity:did:plc:bad:bluesky']);

      await suppressDid(db as never, valkey as never, 'did:plc:bad');

      // Should insert into suppressedDids
      expect(db.insert).toHaveBeenCalled();
      expect(db._mocks.onConflictDoNothing).toHaveBeenCalled();

      // Should delete userAppStats
      expect(db.delete).toHaveBeenCalled();

      // Should delete Valkey keys
      expect(valkey.del).toHaveBeenCalledWith('pds-scan:did:plc:bad');
      expect(valkey.del).toHaveBeenCalledWith('activity-teaser:did:plc:bad');
      expect(valkey.keys).toHaveBeenCalledWith('activity:did:plc:bad:*');
    });
  });
});

// Need afterEach at module level for vitest
import { afterEach } from 'vitest';
