import { describe, it, expect } from 'vitest';
import {
  connections,
  oauthSessions,
  jetstreamCursor,
  externalAccounts,
  externalAccountVerifications,
} from '../../src/db/schema/index.js';

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

  it('externalAccounts table has required columns', () => {
    expect(externalAccounts.did).toBeDefined();
    expect(externalAccounts.rkey).toBeDefined();
    expect(externalAccounts.platform).toBeDefined();
    expect(externalAccounts.url).toBeDefined();
    expect(externalAccounts.label).toBeDefined();
    expect(externalAccounts.feedUrl).toBeDefined();
  });

  it('externalAccountVerifications table has required columns', () => {
    expect(externalAccountVerifications.did).toBeDefined();
    expect(externalAccountVerifications.url).toBeDefined();
    expect(externalAccountVerifications.verified).toBeDefined();
    expect(externalAccountVerifications.verifiedVia).toBeDefined();
    expect(externalAccountVerifications.checkedAt).toBeDefined();
  });
});
