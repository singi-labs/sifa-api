import pino from 'pino';

const logger = pino({ name: 'pds-provider' });

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

export function extractPdsHost(didDoc: { service?: { id: string; serviceEndpoint: string }[] }): string | null {
  const pdsService = didDoc.service?.find(
    (s) => s.id === '#atproto_pds',
  );
  if (!pdsService?.serviceEndpoint) return null;
  try {
    return new URL(pdsService.serviceEndpoint).hostname;
  } catch {
    return null;
  }
}

export async function resolvePdsHost(did: string): Promise<string | null> {
  if (did.startsWith('did:plc:')) {
    try {
      const res = await fetch(`https://plc.directory/${encodeURIComponent(did)}`, {
        signal: AbortSignal.timeout(3000),
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return null;
      const doc = await res.json() as { service?: { id: string; serviceEndpoint: string }[] };
      return extractPdsHost(doc);
    } catch (err) {
      logger.warn({ did, err }, 'Failed to resolve DID document from plc.directory');
      return null;
    }
  }

  if (did.startsWith('did:web:')) {
    const host = did.slice('did:web:'.length).replace(/%3A/g, ':');
    try {
      const res = await fetch(`https://${host}/.well-known/did.json`, {
        signal: AbortSignal.timeout(3000),
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return null;
      const doc = await res.json() as { service?: { id: string; serviceEndpoint: string }[] };
      return extractPdsHost(doc);
    } catch (err) {
      logger.warn({ did, err }, 'Failed to resolve did:web document');
      return null;
    }
  }

  return null;
}
