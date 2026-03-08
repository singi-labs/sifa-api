import { describe, it, expect } from 'vitest';
import { mapBskyFollowToConnection } from '../../src/services/bluesky-follows.js';

describe('Bluesky follow import', () => {
  it('maps Bluesky follow to connection row', () => {
    const conn = mapBskyFollowToConnection('did:plc:follower', {
      did: 'did:plc:subject',
      handle: 'alice.bsky.social',
      createdAt: '2026-01-01T00:00:00Z',
    });
    expect(conn.source).toBe('bluesky');
    expect(conn.followerDid).toBe('did:plc:follower');
    expect(conn.subjectDid).toBe('did:plc:subject');
  });

  it('sets createdAt as Date from ISO string', () => {
    const conn = mapBskyFollowToConnection('did:plc:follower', {
      did: 'did:plc:subject',
      handle: 'alice.bsky.social',
      createdAt: '2026-01-01T00:00:00Z',
    });
    expect(conn.createdAt).toBeInstanceOf(Date);
    expect(conn.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
});
