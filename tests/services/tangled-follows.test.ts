import { describe, it, expect } from 'vitest';
import { mapTangledFollowToConnection } from '../../src/services/tangled-follows.js';

describe('Tangled follow import', () => {
  it('maps Tangled follow to connection row with source tangled', () => {
    const conn = mapTangledFollowToConnection('did:plc:follower', {
      did: 'did:plc:subject',
      handle: 'alice.tangled.sh',
      createdAt: '2026-01-15T12:00:00Z',
    });
    expect(conn.source).toBe('tangled');
    expect(conn.followerDid).toBe('did:plc:follower');
    expect(conn.subjectDid).toBe('did:plc:subject');
  });

  it('sets createdAt as Date from ISO string', () => {
    const conn = mapTangledFollowToConnection('did:plc:follower', {
      did: 'did:plc:subject',
      handle: 'bob.tangled.sh',
      createdAt: '2026-02-01T00:00:00Z',
    });
    expect(conn.createdAt).toBeInstanceOf(Date);
    expect(conn.createdAt.toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });
});
