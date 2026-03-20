import { describe, it, expect, vi } from 'vitest';

// Mock drizzle to capture insert values
const insertedValues: unknown[] = [];
vi.mock('../../src/db/schema/index.js', () => ({
  connections: 'connections_table',
}));

vi.mock('drizzle-orm/pg-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm/pg-core')>();
  return actual;
});

const mockDb = {
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockImplementation((rows: unknown[]) => {
      insertedValues.push(...rows);
      return { onConflictDoNothing: vi.fn() };
    }),
  }),
};

// Must import after mocks
const { importBlueskyFollows } = await import('../../src/services/bluesky-follows.js');

describe('importBlueskyFollows', () => {
  it('maps follows to connection rows with source bluesky', async () => {
    insertedValues.length = 0;
    await importBlueskyFollows(mockDb as never, 'did:plc:follower', [
      { did: 'did:plc:subject', createdAt: '2026-01-01T00:00:00Z' },
    ]);

    expect(insertedValues).toHaveLength(1);
    const row = insertedValues[0] as Record<string, unknown>;
    expect(row.source).toBe('bluesky');
    expect(row.followerDid).toBe('did:plc:follower');
    expect(row.subjectDid).toBe('did:plc:subject');
    expect(row.createdAt).toBeInstanceOf(Date);
    expect((row.createdAt as Date).toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('skips insert when follows array is empty', async () => {
    mockDb.insert.mockClear();
    await importBlueskyFollows(mockDb as never, 'did:plc:follower', []);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});
