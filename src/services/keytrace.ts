import { Agent } from '@atproto/api';
import { z } from 'zod';
import type { ValkeyClient } from '../cache/index.js';
import { normalizeUrl, extractPlatformUsername } from '../lib/url-utils.js';
import { logger as rootLogger } from '../logger.js';

const logger = rootLogger.child({ module: 'keytrace' });

const KEYTRACE_CACHE_TTL = 7200; // 2 hours
const KEYTRACE_COLLECTION = 'dev.keytrace.claim';
const PDS_TIMEOUT_MS = 3000;

const keytraceClaimSchema = z.object({
  url: z.string().min(1),
  platform: z.string().min(1),
  createdAt: z.string().optional(),
});

export interface KeytraceClaim {
  rkey: string;
  platform: string;
  url: string;
  claimedAt: string;
}

export interface SifaExternalAccount {
  rkey: string;
  platform: string;
  url: string;
  label: string | null;
  feedUrl: string | null;
  isPrimary: boolean;
  verified: boolean;
  verifiedVia: string | null;
  verifiable: boolean;
}

export interface MergedExternalAccount {
  rkey: string;
  platform: string;
  url: string;
  label: string | null;
  feedUrl: string | null;
  isPrimary: boolean;
  verifiable: boolean;
  verified: boolean;
  verifiedVia: string | null;
  source: 'sifa' | 'keytrace';
  keytraceVerified: boolean;
  keytraceClaim?: {
    rkey: string;
    claimedAt: string;
  };
}

function cacheKey(did: string): string {
  return `keytrace:claims:${did}`;
}

export async function invalidateKeytraceCache(
  did: string,
  valkey: ValkeyClient | null,
): Promise<void> {
  if (!valkey) return;
  try {
    await valkey.del(cacheKey(did));
  } catch (err) {
    logger.warn({ err, did }, 'Failed to invalidate Keytrace cache');
  }
}

export async function fetchKeytraceClaims(
  did: string,
  pdsHost: string,
  valkey: ValkeyClient | null,
): Promise<KeytraceClaim[]> {
  // Check cache first
  if (valkey) {
    try {
      const cached = await valkey.get(cacheKey(did));
      if (cached) {
        return JSON.parse(cached) as KeytraceClaim[];
      }
    } catch (err) {
      logger.warn({ err, did }, 'Failed to read Keytrace cache');
    }
  }

  // Fetch from PDS
  try {
    const agent = new Agent(`https://${pdsHost}`);
    const res = await agent.com.atproto.repo.listRecords(
      {
        repo: did,
        collection: KEYTRACE_COLLECTION,
        limit: 100,
      },
      { signal: AbortSignal.timeout(PDS_TIMEOUT_MS) },
    );

    const claims: KeytraceClaim[] = [];
    for (const record of res.data.records) {
      const parsed = keytraceClaimSchema.safeParse(record.value);
      if (!parsed.success) continue;

      const rkey = record.uri.split('/').pop() ?? '';
      claims.push({
        rkey,
        platform: parsed.data.platform,
        url: parsed.data.url,
        claimedAt: parsed.data.createdAt ?? new Date().toISOString(),
      });
    }

    // Cache the result
    if (valkey) {
      try {
        await valkey.setex(cacheKey(did), KEYTRACE_CACHE_TTL, JSON.stringify(claims));
      } catch (err) {
        logger.warn({ err, did }, 'Failed to cache Keytrace claims');
      }
    }

    return claims;
  } catch (err) {
    logger.warn({ err, did }, 'Failed to fetch Keytrace claims from PDS');
    return [];
  }
}

export function matchClaimsToAccounts(
  claims: KeytraceClaim[],
  accounts: SifaExternalAccount[],
): { matched: Map<string, KeytraceClaim>; unmatched: KeytraceClaim[] } {
  const matched = new Map<string, KeytraceClaim>();
  const unmatched: KeytraceClaim[] = [];

  for (const claim of claims) {
    let found = false;
    const claimNormalized = normalizeUrl(claim.url);

    // Primary: normalized URL match
    for (const account of accounts) {
      if (matched.has(account.rkey)) continue;
      if (normalizeUrl(account.url) === claimNormalized) {
        matched.set(account.rkey, claim);
        found = true;
        break;
      }
    }

    // Fallback: platform + username match
    if (!found) {
      const claimUsername = extractPlatformUsername(claim.platform, claim.url);
      if (claimUsername) {
        for (const account of accounts) {
          if (matched.has(account.rkey)) continue;
          if (account.platform.toLowerCase() !== claim.platform.toLowerCase()) continue;
          const accountUsername = extractPlatformUsername(account.platform, account.url);
          if (accountUsername && accountUsername.toLowerCase() === claimUsername.toLowerCase()) {
            matched.set(account.rkey, claim);
            found = true;
            break;
          }
        }
      }
    }

    if (!found) {
      unmatched.push(claim);
    }
  }

  return { matched, unmatched };
}

export function mergeExternalAccounts(
  accounts: SifaExternalAccount[],
  claims: KeytraceClaim[],
): MergedExternalAccount[] {
  const { matched, unmatched } = matchClaimsToAccounts(claims, accounts);

  const merged: MergedExternalAccount[] = accounts.map((account) => {
    const claim = matched.get(account.rkey);
    return {
      ...account,
      source: 'sifa' as const,
      keytraceVerified: !!claim,
      ...(claim
        ? {
            keytraceClaim: {
              rkey: claim.rkey,
              claimedAt: claim.claimedAt,
            },
          }
        : {}),
    };
  });

  for (const claim of unmatched) {
    merged.push({
      rkey: claim.rkey,
      platform: claim.platform,
      url: claim.url,
      label: null,
      feedUrl: null,
      isPrimary: false,
      verifiable: false,
      verified: false,
      verifiedVia: null,
      source: 'keytrace',
      keytraceVerified: true,
      keytraceClaim: {
        rkey: claim.rkey,
        claimedAt: claim.claimedAt,
      },
    });
  }

  return merged;
}
