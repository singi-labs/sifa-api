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

    it('maps fyi.unravel.frontpage.post to frontpage via scanCollections', () => {
      const result = getAppForCollection('fyi.unravel.frontpage.post');
      expect(result).toBeDefined();
      expect(result?.id).toBe('frontpage');
    });

    it('maps social.psky.feed.post to picosky via scanCollections', () => {
      const result = getAppForCollection('social.psky.feed.post');
      expect(result).toBeDefined();
      expect(result?.id).toBe('picosky');
    });

    it('maps link.pastesphere.snippet to pastesphere via scanCollections', () => {
      const result = getAppForCollection('link.pastesphere.snippet');
      expect(result).toBeDefined();
      expect(result?.id).toBe('pastesphere');
    });

    it('maps sh.tangled.repo to tangled via scanCollections', () => {
      const result = getAppForCollection('sh.tangled.repo');
      expect(result).toBeDefined();
      expect(result?.id).toBe('tangled');
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

    it('includes cross-app low-signal collections', () => {
      expect(EXCLUDED_COLLECTIONS).toContain('sh.tangled.graph.follow');
      expect(EXCLUDED_COLLECTIONS).toContain('sh.tangled.feed.star');
      expect(EXCLUDED_COLLECTIONS).toContain('events.smokesignal.calendar.rsvp');
      expect(EXCLUDED_COLLECTIONS).toContain('fyi.unravel.frontpage.vote');
    });

    it('has exactly 10 entries', () => {
      expect(EXCLUDED_COLLECTIONS).toHaveLength(10);
    });
  });
});
