import { describe, expect, it } from 'vitest';
import {
  EXCLUDED_COLLECTIONS,
  getAppForCollection,
  getAppsRegistry,
} from '../../src/lib/atproto-app-registry.js';

describe('atproto-app-registry', () => {
  describe('getAppsRegistry', () => {
    it('returns all entries with required fields', () => {
      const registry = getAppsRegistry();
      expect(registry.length).toBeGreaterThan(0);
      for (const entry of registry) {
        expect(entry.id).toBeTruthy();
        expect(entry.name).toBeTruthy();
        expect(entry.category).toBeTruthy();
        expect(entry.collectionPrefixes.length).toBeGreaterThan(0);
        expect(entry.color).toBeTruthy();
        expect(Array.isArray(entry.scanCollections)).toBe(true);
      }
    });
  });

  describe('getAppForCollection', () => {
    it('maps known collection to its app via scanCollections', () => {
      const result = getAppForCollection('app.bsky.feed.post');
      expect(result).toBeDefined();
      expect(result?.id).toBe('bluesky');
      expect(result?.matchedPrefix).toBe('app.bsky.feed');
    });

    it('maps com.whtwnd.blog.entry to whitewind via scanCollections', () => {
      const result = getAppForCollection('com.whtwnd.blog.entry');
      expect(result).toBeDefined();
      expect(result?.id).toBe('whitewind');
      expect(result?.matchedPrefix).toBe('com.whtwnd');
    });

    it('maps by prefix for unknown sub-collections', () => {
      const result = getAppForCollection('sh.tangled.some.new');
      expect(result).toBeDefined();
      expect(result?.id).toBe('tangled');
      expect(result?.matchedPrefix).toBe('sh.tangled');
    });

    it('maps events.smokesignal.foo by prefix', () => {
      const result = getAppForCollection('events.smokesignal.foo');
      expect(result).toBeDefined();
      expect(result?.id).toBe('smokesignal');
    });

    it('returns undefined for unknown collections', () => {
      const result = getAppForCollection('com.unknown.something');
      expect(result).toBeUndefined();
    });

    it('prefers scanCollections exact match over prefix match', () => {
      // app.bsky.feed.post should match bluesky via scanCollections,
      // not just prefix
      const result = getAppForCollection('app.bsky.feed.post');
      expect(result?.id).toBe('bluesky');
    });
  });

  describe('EXCLUDED_COLLECTIONS', () => {
    it('contains expected entries', () => {
      expect(EXCLUDED_COLLECTIONS).toContain('app.bsky.feed.like');
      expect(EXCLUDED_COLLECTIONS).toContain('app.bsky.feed.repost');
      expect(EXCLUDED_COLLECTIONS).toContain('app.bsky.graph.follow');
      expect(EXCLUDED_COLLECTIONS).toContain('app.bsky.graph.block');
      expect(EXCLUDED_COLLECTIONS).toContain('app.bsky.graph.mute');
      expect(EXCLUDED_COLLECTIONS).toContain('app.bsky.graph.listitem');
    });

    it('has exactly 6 entries', () => {
      expect(EXCLUDED_COLLECTIONS).toHaveLength(6);
    });
  });
});
