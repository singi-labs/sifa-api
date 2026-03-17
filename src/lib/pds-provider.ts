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
];

export function mapPdsHostToProvider(host: string): PdsProviderInfo | null {
  for (const entry of KNOWN_PDS_HOSTS) {
    if (entry.pattern.test(host)) {
      return { name: entry.name, host };
    }
  }
  return null;
}

export function extractPdsHostFromEndpoint(endpoint: string): string | null {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return null;
  }
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

export async function resolvePdsHost(did: string): Promise<string | null> {
  if (did.startsWith('did:plc:')) {
    try {
      return await fetchDidDoc(`https://plc.directory/${encodeURIComponent(did)}`);
    } catch (err) {
      logger.warn({ did, err }, 'Failed to resolve DID document from plc.directory');
      return null;
    }
  }

  if (did.startsWith('did:web:')) {
    try {
      const suffix = did.slice('did:web:'.length);
      const [encodedHost = '', ...pathParts] = suffix.split(':');
      const host = decodeURIComponent(encodedHost);
      const path = pathParts.length > 0
        ? pathParts.map(decodeURIComponent).join('/') + '/did.json'
        : '.well-known/did.json';
      return await fetchDidDoc(`https://${host}/${path}`);
    } catch (err) {
      logger.warn({ did, err }, 'Failed to resolve did:web document');
      return null;
    }
  }

  return null;
}
