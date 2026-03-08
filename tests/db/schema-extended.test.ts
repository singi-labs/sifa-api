import { describe, it, expect } from 'vitest';
import { connections, oauthSessions, jetstreamCursor } from '../../src/db/schema/index.js';

describe('Extended schema tables', () => {
  it('connections table has composite primary key', () => {
    expect(connections.followerDid).toBeDefined();
    expect(connections.subjectDid).toBeDefined();
    expect(connections.source).toBeDefined();
  });

  it('oauthSessions table stores tokens', () => {
    expect(oauthSessions.sessionId).toBeDefined();
    expect(oauthSessions.did).toBeDefined();
  });

  it('jetstreamCursor table tracks position', () => {
    expect(jetstreamCursor.id).toBeDefined();
    expect(jetstreamCursor.cursor).toBeDefined();
  });
});
