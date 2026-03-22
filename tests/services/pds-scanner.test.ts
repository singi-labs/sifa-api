import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AppRegistryEntry } from '../../src/lib/atproto-app-registry.js';

// Mock the app registry
vi.mock('../../src/lib/atproto-app-registry.js', () => ({
  getAppsRegistry: vi.fn(),
  EXCLUDED_COLLECTIONS: ['app.bsky.feed.like', 'app.bsky.feed.repost'],
}));

// Mock @atproto/api
const mockListRecords = vi.fn();
const mockDescribeRepo = vi.fn();
vi.mock('@atproto/api', () => {
  class MockAgent {
    com = {
      atproto: {
        repo: {
          listRecords: mockListRecords,
          describeRepo: mockDescribeRepo,
        },
      },
    };
  }
  return { Agent: MockAgent };
});

import { scanUserApps } from '../../src/services/pds-scanner.js';
import { getAppsRegistry } from '../../src/lib/atproto-app-registry.js';

const mockedGetAppsRegistry = vi.mocked(getAppsRegistry);

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function makeRecord(createdAt: string, uri?: string) {
  return {
    uri: uri ?? 'at://did:plc:test/collection/rkey',
    cid: 'bafytest',
    value: { createdAt },
  };
}

function makeRegistry(overrides: Partial<AppRegistryEntry>[] = []): AppRegistryEntry[] {
  const defaults: AppRegistryEntry[] = [
    {
      id: 'bluesky',
      name: 'Bluesky',
      category: 'Posts',
      collectionPrefixes: ['app.bsky.feed'],
      scanCollections: ['app.bsky.feed.post'],
      color: 'sky',
    },
    {
      id: 'whitewind',
      name: 'Whitewind',
      category: 'Articles',
      collectionPrefixes: ['com.whtwnd'],
      scanCollections: ['com.whtwnd.blog.entry'],
      color: 'slate',
    },
  ];
  if (overrides.length > 0) {
    return overrides.map((o, i) => ({
      ...(defaults[i % defaults.length] as AppRegistryEntry),
      ...o,
    }));
  }
  return defaults;
}

describe('scanUserApps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: describeRepo fails so existing tests fall back to scanning all
    mockDescribeRepo.mockRejectedValue(new Error('Not mocked'));
  });

  it('calls listRecords for each scan collection', async () => {
    mockedGetAppsRegistry.mockReturnValue(makeRegistry());
    mockListRecords.mockResolvedValue({
      data: { records: [], cursor: undefined },
    });

    await scanUserApps('https://pds.example.com', 'did:plc:test');

    expect(mockListRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: 'did:plc:test',
        collection: 'app.bsky.feed.post',
        limit: 100,
      }),
      expect.anything(),
    );
    expect(mockListRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: 'did:plc:test',
        collection: 'com.whtwnd.blog.entry',
        limit: 100,
      }),
      expect.anything(),
    );
  });

  it('counts records within the 90-day window', async () => {
    mockedGetAppsRegistry.mockReturnValue(
      makeRegistry([
        {
          id: 'bluesky',
          name: 'Bluesky',
          category: 'Posts',
          collectionPrefixes: ['app.bsky.feed'],
          scanCollections: ['app.bsky.feed.post'],
          color: 'sky',
        },
      ]),
    );

    mockListRecords.mockResolvedValueOnce({
      data: {
        records: [
          makeRecord(daysAgo(1)),
          makeRecord(daysAgo(10)),
          makeRecord(daysAgo(89)),
          makeRecord(daysAgo(100)), // outside window
        ],
        cursor: undefined,
      },
    });

    const results = await scanUserApps('https://pds.example.com', 'did:plc:test');
    const bluesky = results.find((r) => r.appId === 'bluesky');

    expect(bluesky).toBeDefined();
    expect(bluesky?.recentCount).toBe(3);
    expect(bluesky?.isActive).toBe(true);
  });

  it('stops pagination when all records fall outside the 90-day window', async () => {
    mockedGetAppsRegistry.mockReturnValue(
      makeRegistry([
        {
          id: 'bluesky',
          name: 'Bluesky',
          category: 'Posts',
          collectionPrefixes: ['app.bsky.feed'],
          scanCollections: ['app.bsky.feed.post'],
          color: 'sky',
        },
      ]),
    );

    // Page 1: some recent records + cursor
    mockListRecords.mockResolvedValueOnce({
      data: {
        records: [makeRecord(daysAgo(5)), makeRecord(daysAgo(30))],
        cursor: 'page2',
      },
    });

    // Page 2: all records outside window
    mockListRecords.mockResolvedValueOnce({
      data: {
        records: [makeRecord(daysAgo(100)), makeRecord(daysAgo(120))],
        cursor: 'page3',
      },
    });

    await scanUserApps('https://pds.example.com', 'did:plc:test');

    // Should NOT have fetched page 3
    expect(mockListRecords).toHaveBeenCalledTimes(2);
  });

  it('skips excluded collections', async () => {
    mockedGetAppsRegistry.mockReturnValue([
      {
        id: 'bluesky-likes',
        name: 'Bluesky Likes',
        category: 'Posts',
        collectionPrefixes: ['app.bsky.feed'],
        scanCollections: ['app.bsky.feed.like'], // excluded
        color: 'sky',
      },
    ]);

    mockListRecords.mockResolvedValue({
      data: { records: [], cursor: undefined },
    });

    const results = await scanUserApps('https://pds.example.com', 'did:plc:test');

    expect(mockListRecords).not.toHaveBeenCalled();
    // Should still return a result for the app, but with zero counts
    const likesApp = results.find((r) => r.appId === 'bluesky-likes');
    expect(likesApp).toBeDefined();
    expect(likesApp?.recentCount).toBe(0);
    expect(likesApp?.isActive).toBe(false);
  });

  it('does not fail the entire scan when one collection errors', async () => {
    mockedGetAppsRegistry.mockReturnValue(makeRegistry());

    // Bluesky fails
    mockListRecords.mockImplementation(async (params: { collection: string }) => {
      if (params.collection === 'app.bsky.feed.post') {
        throw new Error('PDS timeout');
      }
      return {
        data: {
          records: [makeRecord(daysAgo(5))],
          cursor: undefined,
        },
      };
    });

    const results = await scanUserApps('https://pds.example.com', 'did:plc:test');

    expect(results).toHaveLength(2);

    const bluesky = results.find((r) => r.appId === 'bluesky');
    expect(bluesky?.isActive).toBe(false);
    expect(bluesky?.recentCount).toBe(0);

    const whitewind = results.find((r) => r.appId === 'whitewind');
    expect(whitewind?.isActive).toBe(true);
    expect(whitewind?.recentCount).toBe(1);
  });

  it('captures the most recent latestRecordAt', async () => {
    const recentDate = daysAgo(2);
    const olderDate = daysAgo(50);

    mockedGetAppsRegistry.mockReturnValue(
      makeRegistry([
        {
          id: 'bluesky',
          name: 'Bluesky',
          category: 'Posts',
          collectionPrefixes: ['app.bsky.feed'],
          scanCollections: ['app.bsky.feed.post'],
          color: 'sky',
        },
      ]),
    );

    mockListRecords.mockResolvedValueOnce({
      data: {
        records: [makeRecord(olderDate), makeRecord(recentDate)],
        cursor: undefined,
      },
    });

    const results = await scanUserApps('https://pds.example.com', 'did:plc:test');
    const bluesky = results.find((r) => r.appId === 'bluesky');

    expect(bluesky?.latestRecordAt).toEqual(new Date(recentDate));
  });

  it('uses first collectionPrefix when scanCollections is empty', async () => {
    mockedGetAppsRegistry.mockReturnValue([
      {
        id: 'tangled',
        name: 'Tangled',
        category: 'Code',
        collectionPrefixes: ['sh.tangled'],
        scanCollections: [],
        color: 'emerald',
      },
    ]);

    mockDescribeRepo.mockResolvedValue({
      data: { collections: ['sh.tangled'] },
    });

    mockListRecords.mockResolvedValue({
      data: { records: [], cursor: undefined },
    });

    await scanUserApps('https://pds.example.com', 'did:plc:test');

    expect(mockListRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'sh.tangled',
      }),
      expect.anything(),
    );
  });

  describe('describeRepo optimization', () => {
    it('only scans collections that exist in the repo', async () => {
      mockedGetAppsRegistry.mockReturnValue(makeRegistry());

      // describeRepo says only whitewind collection exists
      mockDescribeRepo.mockResolvedValue({
        data: { collections: ['com.whtwnd.blog.entry'] },
      });

      mockListRecords.mockResolvedValue({
        data: { records: [makeRecord(daysAgo(5))], cursor: undefined },
      });

      const results = await scanUserApps('https://pds.example.com', 'did:plc:test');

      // Should only call listRecords for whitewind, not bluesky
      expect(mockListRecords).toHaveBeenCalledTimes(1);
      expect(mockListRecords).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'com.whtwnd.blog.entry' }),
        expect.anything(),
      );

      // Bluesky should be reported as inactive
      const bluesky = results.find((r) => r.appId === 'bluesky');
      expect(bluesky?.isActive).toBe(false);
      expect(bluesky?.recentCount).toBe(0);

      // Whitewind should be active
      const whitewind = results.find((r) => r.appId === 'whitewind');
      expect(whitewind?.isActive).toBe(true);
    });

    it('falls back to scanning all collections when describeRepo fails', async () => {
      mockedGetAppsRegistry.mockReturnValue(makeRegistry());

      // describeRepo throws an error
      mockDescribeRepo.mockRejectedValue(new Error('Not implemented'));

      mockListRecords.mockResolvedValue({
        data: { records: [], cursor: undefined },
      });

      await scanUserApps('https://pds.example.com', 'did:plc:test');

      // Should still call listRecords for both apps
      expect(mockListRecords).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'app.bsky.feed.post' }),
        expect.anything(),
      );
      expect(mockListRecords).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'com.whtwnd.blog.entry' }),
        expect.anything(),
      );
    });

    it('returns isActive false immediately for apps with no matching collections', async () => {
      mockedGetAppsRegistry.mockReturnValue(makeRegistry());

      // describeRepo returns empty collections array — user has nothing
      mockDescribeRepo.mockResolvedValue({
        data: { collections: [] },
      });

      const results = await scanUserApps('https://pds.example.com', 'did:plc:test');

      // No listRecords calls at all
      expect(mockListRecords).not.toHaveBeenCalled();

      // Both apps inactive
      for (const result of results) {
        expect(result.isActive).toBe(false);
        expect(result.recentCount).toBe(0);
        expect(result.latestRecordAt).toBeNull();
      }
    });
  });
});
