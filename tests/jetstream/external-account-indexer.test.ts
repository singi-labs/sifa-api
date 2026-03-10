import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createExternalAccountIndexer } from '../../src/jetstream/indexers/external-account.js';
import type { JetstreamEvent } from '../../src/jetstream/types.js';

const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockReturnValue({
    onConflictDoUpdate: vi.fn(),
  }),
});

const mockDelete = vi.fn().mockReturnValue({
  where: vi.fn(),
});

const mockDb = {
  insert: mockInsert,
  delete: mockDelete,
} as never;

describe('ExternalAccount indexer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('indexes a create event', async () => {
    const indexer = createExternalAccountIndexer(mockDb);
    const event: JetstreamEvent = {
      did: 'did:plc:test',
      kind: 'commit',
      time_us: 1000000,
      commit: {
        collection: 'id.sifa.profile.externalAccount',
        operation: 'create',
        rkey: 'abc123',
        record: {
          platform: 'github',
          url: 'https://github.com/testuser',
          label: 'My GitHub',
          feedUrl: null,
          createdAt: '2026-03-10T00:00:00Z',
        },
      },
    };

    await indexer(event);
    expect(mockInsert).toHaveBeenCalled();
  });

  it('handles a delete event', async () => {
    const indexer = createExternalAccountIndexer(mockDb);
    const event: JetstreamEvent = {
      did: 'did:plc:test',
      kind: 'commit',
      time_us: 1000000,
      commit: {
        collection: 'id.sifa.profile.externalAccount',
        operation: 'delete',
        rkey: 'abc123',
        record: null,
      },
    };

    await indexer(event);
    expect(mockDelete).toHaveBeenCalled();
  });

  it('skips events without commit', async () => {
    const indexer = createExternalAccountIndexer(mockDb);
    const event: JetstreamEvent = {
      did: 'did:plc:test',
      kind: 'commit',
      time_us: 1000000,
    };

    await indexer(event);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
