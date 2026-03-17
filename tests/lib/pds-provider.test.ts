import { describe, it, expect, vi, afterEach } from 'vitest';
import { extractPdsHost, mapPdsHostToProvider, resolvePdsHost } from '../../src/lib/pds-provider.js';

describe('extractPdsHost', () => {
  it('extracts hostname from #atproto_pds service entry', () => {
    const doc = {
      service: [
        { id: '#atproto_pds', serviceEndpoint: 'https://morel.us-east.host.bsky.network' },
      ],
    };
    expect(extractPdsHost(doc)).toBe('morel.us-east.host.bsky.network');
  });

  it('returns null when no #atproto_pds service exists', () => {
    const doc = { service: [{ id: '#atproto_labeler', serviceEndpoint: 'https://example.com' }] };
    expect(extractPdsHost(doc)).toBeNull();
  });

  it('returns null when service array is missing', () => {
    expect(extractPdsHost({})).toBeNull();
  });

  it('returns null for invalid serviceEndpoint URL', () => {
    const doc = {
      service: [{ id: '#atproto_pds', serviceEndpoint: 'not-a-url' }],
    };
    expect(extractPdsHost(doc)).toBeNull();
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

  it('returns null for unknown PDS host', () => {
    expect(mapPdsHostToProvider('my-pds.example.com')).toBeNull();
  });

  it('returns null for self-hosted PDS', () => {
    expect(mapPdsHostToProvider('pds.alice.dev')).toBeNull();
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
          service: [
            { id: '#atproto_pds', serviceEndpoint: 'https://morel.us-east.host.bsky.network' },
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
          service: [
            { id: '#atproto_pds', serviceEndpoint: 'https://pds.example.com' },
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

  it('returns null when plc.directory returns 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 404 }),
    );

    const result = await resolvePdsHost('did:plc:notfound');
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
