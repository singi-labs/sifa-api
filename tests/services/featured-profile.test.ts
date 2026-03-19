import { describe, it, expect } from 'vitest';
import { getTodayUtc, selectFeaturedProfile } from '../../src/services/featured-profile.js';

describe('featured-profile service', () => {
  describe('getTodayUtc', () => {
    it('returns a valid YYYY-MM-DD date string', () => {
      const today = getTodayUtc();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns a parseable date', () => {
      const today = getTodayUtc();
      const parsed = new Date(today + 'T00:00:00Z');
      expect(parsed.getTime()).not.toBeNaN();
    });
  });

  describe('selectFeaturedProfile', () => {
    it('is exported as a function', () => {
      expect(typeof selectFeaturedProfile).toBe('function');
    });
  });
});
