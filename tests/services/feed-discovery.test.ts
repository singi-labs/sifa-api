import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { discoverFeedUrl, fetchFeedItems } from '../../src/services/feed-discovery.js';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('discoverFeedUrl', () => {
  it('derives RSS URL for Fediverse accounts', async () => {
    const result = await discoverFeedUrl('fediverse', 'https://mastodon.social/@alice');
    expect(result).toBe('https://mastodon.social/@alice.rss');
  });

  it('returns null for Fediverse URLs without username', async () => {
    const result = await discoverFeedUrl('fediverse', 'https://mastodon.social/about');
    expect(result).toBeNull();
  });

  it('discovers RSS from HTML link tag', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Map([['content-type', 'text/html']]),
      text: () =>
        Promise.resolve(
          '<html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head></html>',
        ),
    });

    const result = await discoverFeedUrl('website', 'https://example.com');
    expect(result).toBe('https://example.com/feed.xml');
  });

  it('returns null when no feed link found', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Map([['content-type', 'text/html']]),
      text: () => Promise.resolve('<html><head><title>Test</title></head></html>'),
    });

    const result = await discoverFeedUrl('website', 'https://example.com');
    expect(result).toBeNull();
  });

  it('returns null for non-feed platforms', async () => {
    const result = await discoverFeedUrl('instagram', 'https://instagram.com/alice');
    expect(result).toBeNull();
  });

  it('returns the URL itself when it is an RSS feed', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Map([['content-type', 'application/rss+xml']]),
      text: () => Promise.resolve('<rss></rss>'),
    });

    const result = await discoverFeedUrl('rss', 'https://example.com/feed.xml');
    expect(result).toBe('https://example.com/feed.xml');
  });
});

describe('fetchFeedItems', () => {
  it('parses RSS feed items', async () => {
    const rssXml = `<?xml version="1.0"?>
    <rss version="2.0">
      <channel>
        <item>
          <title>Test Post</title>
          <link>https://example.com/post-1</link>
          <description>This is a test post description</description>
          <pubDate>Mon, 10 Mar 2026 12:00:00 GMT</pubDate>
        </item>
      </channel>
    </rss>`;

    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(rssXml),
    });

    const items = await fetchFeedItems('https://example.com/feed.xml', 'Blog');
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('Test Post');
    expect(items[0]?.url).toBe('https://example.com/post-1');
    expect(items[0]?.source).toBe('Blog');
  });

  it('parses Atom feed entries', async () => {
    const atomXml = `<?xml version="1.0"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <title>Atom Entry</title>
        <link href="https://example.com/entry-1" />
        <summary>Summary text</summary>
        <published>2026-03-10T12:00:00Z</published>
      </entry>
    </feed>`;

    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(atomXml),
    });

    const items = await fetchFeedItems('https://example.com/atom.xml', 'Blog');
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('Atom Entry');
    expect(items[0]?.url).toBe('https://example.com/entry-1');
  });

  it('returns empty array on fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const items = await fetchFeedItems('https://example.com/feed.xml', 'Blog');
    expect(items).toEqual([]);
  });

  it('returns empty array on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const items = await fetchFeedItems('https://example.com/feed.xml', 'Blog');
    expect(items).toEqual([]);
  });

  it('limits to 20 items', async () => {
    const items = Array.from({ length: 25 }, (_, i) =>
      `<item><title>Post ${i}</title><link>https://example.com/${i}</link></item>`,
    ).join('');

    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(`<rss><channel>${items}</channel></rss>`),
    });

    const result = await fetchFeedItems('https://example.com/feed.xml', 'Blog');
    expect(result).toHaveLength(20);
  });
});
