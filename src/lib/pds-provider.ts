import { isValidDidDoc, getPdsEndpoint } from '@atproto/common-web';
import { logger as rootLogger } from '../logger.js';

const logger = rootLogger.child({ module: 'pds-provider' });

export interface PdsProviderInfo {
  name: string;
  host: string;
}

const KNOWN_PDS_HOSTS: { pattern: RegExp; name: string }[] = [
  { pattern: /\.bsky\.network$/i, name: 'bluesky' },
  { pattern: /^bsky\.social$/i, name: 'bluesky' },
  { pattern: /\.blacksky\.app$/i, name: 'blacksky' },
  { pattern: /^blacksky\.app$/i, name: 'blacksky' },
  { pattern: /\.eurosky\.social$/i, name: 'eurosky' },
  { pattern: /^eurosky\.social$/i, name: 'eurosky' },
  { pattern: /\.northsky\.social$/i, name: 'northsky' },
  { pattern: /^northsky\.social$/i, name: 'northsky' },
  { pattern: /\.selfhosted\.social$/i, name: 'selfhosted-social' },
  { pattern: /^selfhosted\.social$/i, name: 'selfhosted-social' },
];

export function mapPdsHostToProvider(host: string): PdsProviderInfo {
  for (const entry of KNOWN_PDS_HOSTS) {
    if (entry.pattern.test(host)) {
      return { name: entry.name, host };
    }
  }
  return { name: 'selfhosted', host };
}

export function extractPdsHostFromEndpoint(endpoint: string): string | null {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return null;
  }
}

function getDidDocUrl(did: string): string | null {
  if (did.startsWith('did:plc:')) {
    return `https://plc.directory/${encodeURIComponent(did)}`;
  }
  if (did.startsWith('did:web:')) {
    const suffix = did.slice('did:web:'.length);
    const [encodedHost = '', ...pathParts] = suffix.split(':');
    const host = decodeURIComponent(encodedHost);
    const path =
      pathParts.length > 0
        ? pathParts.map(decodeURIComponent).join('/') + '/did.json'
        : '.well-known/did.json';
    return `https://${host}/${path}`;
  }
  return null;
}

async function fetchDidDoc(url: string): Promise<string | null> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(3000),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const doc: unknown = await res.json();
  if (!isValidDidDoc(doc)) return null;
  const endpoint = getPdsEndpoint(doc);
  if (!endpoint) return null;
  return extractPdsHostFromEndpoint(endpoint);
}

/**
 * Resolves the full PDS endpoint URL (e.g. "https://maitake.us-west.host.bsky.network")
 * from a DID. Returns null if resolution fails.
 */
export async function resolvePdsEndpoint(did: string): Promise<string | null> {
  const didDocUrl = getDidDocUrl(did);
  if (!didDocUrl) return null;

  try {
    const res = await fetch(didDocUrl, {
      signal: AbortSignal.timeout(3000),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const doc: unknown = await res.json();
    if (!isValidDidDoc(doc)) return null;
    return getPdsEndpoint(doc) ?? null;
  } catch (err) {
    logger.warn({ did, err }, 'Failed to resolve PDS endpoint');
    return null;
  }
}

export async function resolvePdsHost(did: string): Promise<string | null> {
  const url = getDidDocUrl(did);
  if (!url) return null;

  try {
    return await fetchDidDoc(url);
  } catch (err) {
    logger.warn({ did, err }, 'Failed to resolve DID document');
    return null;
  }
}
