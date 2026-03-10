import { describe, it, expect } from 'vitest';
import { externalAccountSchema, VALID_PLATFORMS } from '../../src/routes/schemas.js';

describe('externalAccountSchema', () => {
  it('accepts valid external account data', () => {
    const result = externalAccountSchema.safeParse({
      platform: 'github',
      url: 'https://github.com/testuser',
    });
    expect(result.success).toBe(true);
  });

  it('accepts all valid platforms', () => {
    for (const platform of VALID_PLATFORMS) {
      const result = externalAccountSchema.safeParse({
        platform,
        url: 'https://example.com',
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid platform', () => {
    const result = externalAccountSchema.safeParse({
      platform: 'invalid',
      url: 'https://example.com',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid URL', () => {
    const result = externalAccountSchema.safeParse({
      platform: 'github',
      url: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional label and feedUrl', () => {
    const result = externalAccountSchema.safeParse({
      platform: 'website',
      url: 'https://example.com',
      label: 'My Blog',
      feedUrl: 'https://example.com/feed.xml',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.label).toBe('My Blog');
      expect(result.data.feedUrl).toBe('https://example.com/feed.xml');
    }
  });

  it('rejects label over 100 characters', () => {
    const result = externalAccountSchema.safeParse({
      platform: 'website',
      url: 'https://example.com',
      label: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('rejects URL over 2000 characters', () => {
    const result = externalAccountSchema.safeParse({
      platform: 'website',
      url: 'https://example.com/' + 'a'.repeat(2000),
    });
    expect(result.success).toBe(false);
  });
});

describe('VALID_PLATFORMS', () => {
  it('contains expected platforms', () => {
    expect(VALID_PLATFORMS).toContain('rss');
    expect(VALID_PLATFORMS).toContain('fediverse');
    expect(VALID_PLATFORMS).toContain('twitter');
    expect(VALID_PLATFORMS).toContain('instagram');
    expect(VALID_PLATFORMS).toContain('github');
    expect(VALID_PLATFORMS).toContain('youtube');
    expect(VALID_PLATFORMS).toContain('linkedin');
    expect(VALID_PLATFORMS).toContain('website');
    expect(VALID_PLATFORMS).toContain('other');
    expect(VALID_PLATFORMS).toHaveLength(9);
  });
});
