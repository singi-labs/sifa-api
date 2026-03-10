import type { Database } from '../db/index.js';
import { externalAccountVerifications } from '../db/schema/index.js';
import { logger } from '../logger.js';

const FETCH_TIMEOUT = 10000;

const VERIFIABLE_PLATFORMS = new Set([
  'rss',
  'fediverse',
  'website',
  'github',
]);

export function isVerifiablePlatform(platform: string): boolean {
  return VERIFIABLE_PLATFORMS.has(platform);
}

export async function verifyRelMe(
  url: string,
  sifaProfileUrl: string,
  did: string,
): Promise<boolean> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: { 'User-Agent': 'Sifa/1.0 (+https://sifa.id)' },
      redirect: 'follow',
    });

    if (!response.ok) return false;

    const html = await response.text();
    const relMeLinks = html.match(/<a[^>]+rel=["'][^"']*me[^"']*["'][^>]*>/gi) ?? [];
    const relMeLinkElements = html.match(/<link[^>]+rel=["'][^"']*me[^"']*["'][^>]*>/gi) ?? [];

    const allLinks = [...relMeLinks, ...relMeLinkElements];

    for (const link of allLinks) {
      const hrefMatch = link.match(/href=["']([^"']+)["']/i);
      if (!hrefMatch) continue;
      const href = hrefMatch[1];
      if (!href) continue;

      if (href.includes(sifaProfileUrl) || href.includes(did)) {
        return true;
      }
    }

    return false;
  } catch (err) {
    logger.warn({ err, url }, 'rel=me verification failed');
    return false;
  }
}

export async function checkAndStoreVerification(
  db: Database,
  did: string,
  url: string,
  platform: string,
  sifaHandle: string,
): Promise<boolean> {
  if (!isVerifiablePlatform(platform)) {
    return false;
  }

  const sifaProfileUrl = `sifa.id/p/${sifaHandle}`;
  const verified = await verifyRelMe(url, sifaProfileUrl, did);

  await db
    .insert(externalAccountVerifications)
    .values({
      did,
      url,
      verified,
      verifiedVia: verified ? 'rel-me' : null,
      checkedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [externalAccountVerifications.did, externalAccountVerifications.url],
      set: {
        verified,
        verifiedVia: verified ? 'rel-me' : null,
        checkedAt: new Date(),
      },
    });

  return verified;
}
