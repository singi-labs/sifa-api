import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyRelMe, isVerifiablePlatform } from '../../src/services/verification.js';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isVerifiablePlatform', () => {
  it('returns true for verifiable platforms', () => {
    expect(isVerifiablePlatform('website')).toBe(true);
    expect(isVerifiablePlatform('fediverse')).toBe(true);
    expect(isVerifiablePlatform('rss')).toBe(true);
    expect(isVerifiablePlatform('github')).toBe(true);
  });

  it('returns false for non-verifiable platforms', () => {
    expect(isVerifiablePlatform('instagram')).toBe(false);
    expect(isVerifiablePlatform('twitter')).toBe(false);
    expect(isVerifiablePlatform('other')).toBe(false);
  });
});

describe('verifyRelMe', () => {
  it('returns true when rel=me link points to Sifa profile', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          '<html><body><a href="https://sifa.id/p/alice" rel="me">Sifa</a></body></html>',
        ),
    });

    const result = await verifyRelMe(
      'https://example.com',
      'sifa.id/p/alice',
      'did:plc:alice',
    );
    expect(result).toBe(true);
  });

  it('returns true when rel=me link points to DID', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          '<html><head><link rel="me" href="https://did:plc:alice123" /></head></html>',
        ),
    });

    const result = await verifyRelMe(
      'https://example.com',
      'sifa.id/p/alice',
      'did:plc:alice123',
    );
    expect(result).toBe(true);
  });

  it('returns false when no rel=me link found', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve('<html><body><a href="https://other.com">Link</a></body></html>'),
    });

    const result = await verifyRelMe(
      'https://example.com',
      'sifa.id/p/alice',
      'did:plc:alice',
    );
    expect(result).toBe(false);
  });

  it('returns false on fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await verifyRelMe(
      'https://example.com',
      'sifa.id/p/alice',
      'did:plc:alice',
    );
    expect(result).toBe(false);
  });

  it('returns false on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false });

    const result = await verifyRelMe(
      'https://example.com',
      'sifa.id/p/alice',
      'did:plc:alice',
    );
    expect(result).toBe(false);
  });
});
