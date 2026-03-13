import { logger } from '../logger.js';

const FETCH_TIMEOUT = 10000;

export async function discoverFeedUrl(platform: string, url: string): Promise<string | null> {
  try {
    if (platform === 'youtube') {
      return discoverYoutubeFeed(url);
    }
    if (platform === 'fediverse') {
      return discoverFediverseFeed(url);
    }
    if (platform === 'rss') {
      return url;
    }
    if (platform === 'website') {
      return discoverRssFeed(url);
    }
    return null;
  } catch (err) {
    logger.warn({ err, platform, url }, 'Feed discovery failed');
    return null;
  }
}

async function discoverYoutubeFeed(url: string): Promise<string | null> {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('youtube.com') && !parsed.hostname.includes('youtu.be')) {
      return null;
    }

    // Direct channel ID URL: /channel/UC...
    const channelMatch = parsed.pathname.match(/\/channel\/(UC[\w-]+)/);
    if (channelMatch?.[1]) {
      return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelMatch[1]}`;
    }

    // For /@handle or /c/name URLs, fetch the page to extract the channel ID
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: { 'User-Agent': 'Sifa/1.0 (+https://sifa.id)' },
    });
    if (!response.ok) return null;

    const html = await response.text();
    const idMatch = html.match(/channel_id=([A-Za-z0-9_-]+)/);
    if (idMatch?.[1]) {
      return `https://www.youtube.com/feeds/videos.xml?channel_id=${idMatch[1]}`;
    }

    return null;
  } catch {
    return null;
  }
}

function discoverFediverseFeed(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const username = pathParts.find((p) => p.startsWith('@'));
    if (username) {
      return `${parsed.origin}/${username}.rss`;
    }
    return null;
  } catch {
    return null;
  }
}

async function discoverRssFeed(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: { 'User-Agent': 'Sifa/1.0 (+https://sifa.id)' },
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') ?? '';
    if (
      contentType.includes('xml') ||
      contentType.includes('rss') ||
      contentType.includes('atom')
    ) {
      return url;
    }

    const html = await response.text();
    const linkMatch = html.match(/<link[^>]+type=["']application\/(rss|atom)\+xml["'][^>]*>/i);
    if (!linkMatch) return null;

    const hrefMatch = linkMatch[0].match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) return null;

    const feedHref = hrefMatch[1];
    if (!feedHref) return null;

    try {
      return new URL(feedHref, url).toString();
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

export interface FeedItem {
  title: string;
  excerpt: string;
  url: string;
  timestamp: string;
  source: string;
}

export async function fetchFeedItems(feedUrl: string, source: string): Promise<FeedItem[]> {
  try {
    const response = await fetch(feedUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: { 'User-Agent': 'Sifa/1.0 (+https://sifa.id)' },
    });

    if (!response.ok) return [];

    const text = await response.text();
    return parseRssFeed(text, source);
  } catch (err) {
    logger.warn({ err, feedUrl }, 'Failed to fetch feed');
    return [];
  }
}

function parseRssFeed(xml: string, source: string): FeedItem[] {
  const items: FeedItem[] = [];

  const itemMatches =
    xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];

  for (const itemXml of itemMatches.slice(0, 20)) {
    const title = extractTag(itemXml, 'title') ?? '';
    const link = extractLink(itemXml);
    const description =
      extractTag(itemXml, 'description') ??
      extractTag(itemXml, 'summary') ??
      extractTag(itemXml, 'content') ??
      '';
    const pubDate =
      extractTag(itemXml, 'pubDate') ??
      extractTag(itemXml, 'published') ??
      extractTag(itemXml, 'updated') ??
      '';

    let plainDesc = description;
    let prev = '';
    while (prev !== plainDesc) {
      prev = plainDesc;
      plainDesc = plainDesc.replace(/<[^>]+>/g, '');
    }
    plainDesc = plainDesc.trim();
    const excerpt = plainDesc.length > 200 ? plainDesc.slice(0, 200) + '...' : plainDesc;

    if (title || link) {
      items.push({
        title: title.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim(),
        excerpt,
        url: link ?? '',
        timestamp: pubDate ? new Date(pubDate).toISOString() : '',
        source,
      });
    }
  }

  return items;
}

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!match) return null;
  const content = match[1];
  if (!content) return null;
  return content.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function extractLink(xml: string): string | null {
  const linkTag = xml.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i);
  if (linkTag) {
    const href = linkTag[1];
    return href ?? null;
  }

  const linkContent = extractTag(xml, 'link');
  return linkContent;
}
