import { describe, it, expect, vi } from 'vitest';

const insertedValues: unknown[] = [];
vi.mock('../../src/db/schema/index.js', () => ({
  connections: 'connections_table',
}));

const mockDb = {
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockImplementation((rows: unknown[]) => {
      insertedValues.push(...rows);
      return { onConflictDoNothing: vi.fn() };
    }),
  }),
};

const { importTangledFollows } = await import('../../src/services/tangled-follows.js');

describe('importTangledFollows', () => {
  it('maps follows to connection rows with source tangled', async () => {
    insertedValues.length = 0;
    await importTangledFollows(mockDb as never, 'did:plc:follower', [
      { did: 'did:plc:subject', createdAt: '2026-01-15T12:00:00Z' },
    ]);

    expect(insertedValues).toHaveLength(1);
    const row = insertedValues[0] as Record<string, unknown>;
    expect(row.source).toBe('tangled');
    expect(row.followerDid).toBe('did:plc:follower');
    expect(row.subjectDid).toBe('did:plc:subject');
    expect(row.createdAt).toBeInstanceOf(Date);
    expect((row.createdAt as Date).toISOString()).toBe('2026-01-15T12:00:00.000Z');
  });

  it('skips insert when follows array is empty', async () => {
    mockDb.insert.mockClear();
    await importTangledFollows(mockDb as never, 'did:plc:follower', []);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});
