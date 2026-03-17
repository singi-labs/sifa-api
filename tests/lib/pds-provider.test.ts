import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  extractPdsHostFromEndpoint,
  mapPdsHostToProvider,
  resolvePdsHost,
} from '../../src/lib/pds-provider.js';

describe('extractPdsHostFromEndpoint', () => {
  it('extracts hostname from a valid PDS endpoint URL', () => {
    expect(extractPdsHostFromEndpoint('https://morel.us-east.host.bsky.network')).toBe(
      'morel.us-east.host.bsky.network',
    );
  });

  it('extracts hostname from URL with path', () => {
    expect(extractPdsHostFromEndpoint('https://pds.example.com/xrpc')).toBe('pds.example.com');
  });

  it('returns null for invalid URL', () => {
    expect(extractPdsHostFromEndpoint('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractPdsHostFromEndpoint('')).toBeNull();
  });
});

describe('mapPdsHostToProvider', () => {
  it('maps bsky.network subdomain to bluesky', () => {
    const result = mapPdsHostToProvider('morel.us-east.host.bsky.network');
    expect(result).toEqual({ name: 'bluesky', host: 'morel.us-east.host.bsky.network' });
  });

  it('maps bsky.social to bluesky', () => {
    const result = mapPdsHostToProvider('bsky.social');
    expect(result).toEqual({ name: 'bluesky', host: 'bsky.social' });
  });

  it('maps blacksky.app to blacksky', () => {
    const result = mapPdsHostToProvider('pds.blacksky.app');
    expect(result).toEqual({ name: 'blacksky', host: 'pds.blacksky.app' });
  });

  it('maps eurosky.social to eurosky', () => {
    const result = mapPdsHostToProvider('pds.eurosky.social');
    expect(result).toEqual({ name: 'eurosky', host: 'pds.eurosky.social' });
  });

  it('maps northsky.social to northsky', () => {
    const result = mapPdsHostToProvider('pds.northsky.social');
    expect(result).toEqual({ name: 'northsky', host: 'pds.northsky.social' });
  });

  it('maps selfhosted.social to selfhosted-social', () => {
    const result = mapPdsHostToProvider('pds.selfhosted.social');
    expect(result).toEqual({ name: 'selfhosted-social', host: 'pds.selfhosted.social' });
  });

  it('returns selfhosted for unknown PDS host', () => {
    expect(mapPdsHostToProvider('my-pds.example.com')).toEqual({
      name: 'selfhosted',
      host: 'my-pds.example.com',
    });
  });

  it('returns selfhosted for individual self-hosted PDS', () => {
    expect(mapPdsHostToProvider('pds.alice.dev')).toEqual({
      name: 'selfhosted',
      host: 'pds.alice.dev',
    });
  });
});

describe('resolvePdsHost', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves did:plc via plc.directory', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'did:plc:abc123',
          service: [
            {
              id: '#atproto_pds',
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: 'https://morel.us-east.host.bsky.network',
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await resolvePdsHost('did:plc:abc123');
    expect(result).toBe('morel.us-east.host.bsky.network');
    expect(fetch).toHaveBeenCalledWith(
      'https://plc.directory/did%3Aplc%3Aabc123',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('resolves did:web via .well-known/did.json', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'did:web:example.com',
          service: [
            {
              id: '#atproto_pds',
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: 'https://pds.example.com',
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await resolvePdsHost('did:web:example.com');
    expect(result).toBe('pds.example.com');
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/.well-known/did.json',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('resolves did:web with path segments', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'did:web:example.com:users:alice',
          service: [
            {
              id: '#atproto_pds',
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: 'https://pds.example.com',
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await resolvePdsHost('did:web:example.com:users:alice');
    expect(result).toBe('pds.example.com');
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/users/alice/did.json',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('returns null when plc.directory returns 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 404 }));

    const result = await resolvePdsHost('did:plc:notfound');
    expect(result).toBeNull();
  });

  it('returns null for invalid DID document', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ notADidDoc: true }), { status: 200 }),
    );

    const result = await resolvePdsHost('did:plc:invalid');
    expect(result).toBeNull();
  });

  it('returns null when fetch throws (timeout)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('timeout'));

    const result = await resolvePdsHost('did:plc:timeout');
    expect(result).toBeNull();
  });

  it('returns null for unsupported DID methods', async () => {
    const result = await resolvePdsHost('did:key:z6Mkabc');
    expect(result).toBeNull();
  });
});
