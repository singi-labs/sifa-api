import { Agent } from '@atproto/api';
import type { FastifyBaseLogger } from 'fastify';
import type { ValkeyClient } from '../cache/index.js';
import { sanitize, sanitizeOptional } from '../lib/sanitize.js';

const COLLECTION = 'site.standard.publication';
const CACHE_TTL = 900; // 15 minutes
const REQUEST_TIMEOUT_MS = 3000;

export interface StandardPublication {
  uri: string;
  title: string;
  url: string | null;
  description: string | null;
  date: string | null;
  source: 'standard';
}

interface StandardPublicationRecord {
  $type?: string;
  name?: string;
  url?: string;
  description?: string;
  createdAt?: string;
}

export async function fetchStandardPublications(
  pdsEndpoint: string,
  did: string,
  valkey: ValkeyClient | null,
  log: FastifyBaseLogger,
): Promise<StandardPublication[]> {
  const cacheKey = `standard:publications:${did}`;

  if (valkey) {
    try {
      const cached = await valkey.get(cacheKey);
      if (cached !== null) return JSON.parse(cached) as StandardPublication[];
    } catch (err) {
      log.warn({ err, cacheKey }, 'valkey.get failed for standard publications');
    }
  }

  try {
    const agent = new Agent(pdsEndpoint);
    const res = await agent.com.atproto.repo.listRecords(
      { repo: did, collection: COLLECTION, limit: 100 },
      { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
    );

    const publications: StandardPublication[] = res.data.records.map((rec) => {
      const val = rec.value as StandardPublicationRecord;
      return {
        uri: rec.uri,
        title: sanitize(val.name ?? 'Untitled'),
        url: val.url ?? null,
        description: sanitizeOptional(val.description) ?? null,
        date: val.createdAt ?? null,
        source: 'standard' as const,
      };
    });

    if (valkey) {
      try {
        await valkey.set(cacheKey, JSON.stringify(publications), 'EX', CACHE_TTL);
      } catch (err) {
        log.warn({ err, cacheKey }, 'valkey.set failed for standard publications');
      }
    }

    return publications;
  } catch (err) {
    log.warn({ err, did }, 'Failed to fetch standard publications from PDS');
    return [];
  }
}

/**
 * Merges Sifa-native publications with Standard publications, deduplicating
 * by URL (primary) or title (fallback). Sifa entries take precedence.
 * Returns merged array sorted chronologically (newest first).
 */
export function mergePublications<
  T extends { title: string; url: string | null; date: string | null },
>(
  sifaPublications: T[],
  standardPublications: StandardPublication[],
): Array<(T & { source: 'sifa' }) | StandardPublication> {
  const sifaUrls = new Set<string>();
  const sifaTitlesLower = new Set<string>();

  for (const pub of sifaPublications) {
    if (pub.url) sifaUrls.add(pub.url);
    sifaTitlesLower.add(pub.title.toLowerCase());
  }

  const deduped = standardPublications.filter((sp) => {
    if (sp.url && sifaUrls.has(sp.url)) return false;
    if (sifaTitlesLower.has(sp.title.toLowerCase())) return false;
    return true;
  });

  const tagged = sifaPublications.map((p) => ({ ...p, source: 'sifa' as const }));
  const merged = [...tagged, ...deduped];

  merged.sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });

  return merged;
}
