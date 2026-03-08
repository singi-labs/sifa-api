import { describe, it, expect } from 'vitest';
import { buildJetstreamUrl, WANTED_COLLECTIONS } from '../../src/jetstream/client.js';

describe('Jetstream client', () => {
  it('builds URL with wanted collections', () => {
    const url = buildJetstreamUrl('wss://jetstream1.us-east.bsky.network/subscribe');
    expect(url).toContain('wantedCollections=id.sifa.profile.self');
    expect(url).toContain('wantedCollections=id.sifa.profile.position');
    expect(url).toContain('wantedCollections=id.sifa.graph.follow');
  });

  it('includes cursor when provided', () => {
    const url = buildJetstreamUrl('wss://jetstream1.us-east.bsky.network/subscribe', 1234567890n);
    expect(url).toContain('cursor=1234567890');
  });

  it('lists all id.sifa.* collections', () => {
    expect(WANTED_COLLECTIONS).toContain('id.sifa.profile.self');
    expect(WANTED_COLLECTIONS).toContain('id.sifa.profile.position');
    expect(WANTED_COLLECTIONS).toContain('id.sifa.profile.education');
    expect(WANTED_COLLECTIONS).toContain('id.sifa.profile.skill');
    expect(WANTED_COLLECTIONS).toContain('id.sifa.graph.follow');
    expect(WANTED_COLLECTIONS).toContain('id.sifa.endorsement');
  });
});
