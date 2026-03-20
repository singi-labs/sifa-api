import { describe, expect, it } from 'vitest';
import { normalizeUrl, extractPlatformUsername } from '../../src/lib/url-utils.js';

describe('url-utils', () => {
  describe('normalizeUrl', () => {
    it('strips https protocol', () => {
      expect(normalizeUrl('https://github.com/gxjansen')).toBe('github.com/gxjansen');
    });

    it('strips http protocol', () => {
      expect(normalizeUrl('http://github.com/gxjansen')).toBe('github.com/gxjansen');
    });

    it('strips trailing slash', () => {
      expect(normalizeUrl('https://github.com/gxjansen/')).toBe('github.com/gxjansen');
    });

    it('strips www prefix', () => {
      expect(normalizeUrl('https://www.linkedin.com/in/gxjansen')).toBe('linkedin.com/in/gxjansen');
    });

    it('lowercases the URL', () => {
      expect(normalizeUrl('https://GitHub.COM/GxJansen')).toBe('github.com/gxjansen');
    });

    it('handles multiple normalizations together', () => {
      expect(normalizeUrl('HTTP://WWW.GitHub.Com/GxJansen/')).toBe('github.com/gxjansen');
    });

    it('handles URLs without protocol', () => {
      expect(normalizeUrl('github.com/gxjansen')).toBe('github.com/gxjansen');
    });

    it('handles empty string', () => {
      expect(normalizeUrl('')).toBe('');
    });

    it('strips multiple trailing slashes', () => {
      expect(normalizeUrl('https://example.com///')).toBe('example.com');
    });
  });

  describe('extractPlatformUsername', () => {
    it('extracts GitHub username', () => {
      expect(extractPlatformUsername('github', 'https://github.com/gxjansen')).toBe('gxjansen');
    });

    it('extracts GitHub username with trailing slash', () => {
      expect(extractPlatformUsername('github', 'https://github.com/gxjansen/')).toBe('gxjansen');
    });

    it('extracts LinkedIn username', () => {
      expect(extractPlatformUsername('linkedin', 'https://www.linkedin.com/in/gxjansen')).toBe(
        'gxjansen',
      );
    });

    it('extracts LinkedIn username with trailing slash', () => {
      expect(extractPlatformUsername('linkedin', 'https://linkedin.com/in/gxjansen/')).toBe(
        'gxjansen',
      );
    });

    it('extracts Twitter/X username from twitter.com', () => {
      expect(extractPlatformUsername('twitter', 'https://twitter.com/guido')).toBe('guido');
    });

    it('extracts Twitter/X username from x.com', () => {
      expect(extractPlatformUsername('twitter', 'https://x.com/guido')).toBe('guido');
    });

    it('extracts Instagram username', () => {
      expect(extractPlatformUsername('instagram', 'https://instagram.com/guido')).toBe('guido');
    });

    it('extracts YouTube channel ID', () => {
      expect(extractPlatformUsername('youtube', 'https://youtube.com/channel/UC1234abc')).toBe(
        'UC1234abc',
      );
    });

    it('extracts YouTube custom handle', () => {
      expect(extractPlatformUsername('youtube', 'https://youtube.com/@guido')).toBe('@guido');
    });

    it('extracts Fediverse username from URL', () => {
      expect(extractPlatformUsername('fediverse', 'https://mastodon.social/@guido')).toBe(
        '@guido@mastodon.social',
      );
    });

    it('returns null for unknown platform', () => {
      expect(extractPlatformUsername('other', 'https://example.com/user')).toBeNull();
    });

    it('returns null for malformed URL', () => {
      expect(extractPlatformUsername('github', 'not-a-url')).toBeNull();
    });

    it('returns null for GitHub URL without username path', () => {
      expect(extractPlatformUsername('github', 'https://github.com')).toBeNull();
    });

    it('is case-insensitive for platform matching', () => {
      expect(extractPlatformUsername('GitHub', 'https://github.com/gxjansen')).toBe('gxjansen');
    });
  });
});
