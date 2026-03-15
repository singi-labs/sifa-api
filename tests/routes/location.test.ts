import { describe, it, expect, beforeAll, afterAll, vi, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../../src/server.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

describe('Location search routes', () => {
  let app: FastifyInstance;
  const tmpKeysDir = join(tmpdir(), `sifa-test-keys-location-${Date.now()}`);
  const jwksPath = join(tmpKeysDir, 'jwks.json');

  beforeAll(async () => {
    mkdirSync(tmpKeysDir, { recursive: true });
    writeFileSync(jwksPath, JSON.stringify({ keys: [{ kty: 'EC', crv: 'P-256', kid: 'test' }] }));

    app = await buildServer({
      NODE_ENV: 'test',
      PORT: 0,
      PUBLIC_URL: 'http://localhost:3100',
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://sifa:sifa@localhost:5432/sifa',
      VALKEY_URL: 'redis://localhost:6379',
      SIFA_DID: 'did:plc:test-location',
      JETSTREAM_URL: 'wss://jetstream1.us-east.bsky.network/subscribe',
      OAUTH_JWKS_PATH: jwksPath,
      GEONAMES_USERNAME: 'testuser',
    });
  });

  afterAll(async () => {
    await app.close();
    rmSync(tmpKeysDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty results when query is too short', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/location/search?q=A' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ results: [] });
  });

  it('returns empty results when query is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/location/search' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ results: [] });
  });

  it('returns city results from GeoNames', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          geonames: [
            {
              geonameId: 2759794,
              name: 'Amsterdam',
              adminName1: 'North Holland',
              countryName: 'The Netherlands',
              countryCode: 'NL',
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/location/search?q=Amsterdam&mode=city',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toEqual({
      city: 'Amsterdam',
      region: 'North Holland',
      country: 'The Netherlands',
      countryCode: 'NL',
      geonameId: 2759794,
      label: 'Amsterdam, North Holland, The Netherlands',
    });
  });

  it('defaults to city mode when mode is not specified', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          geonames: [
            {
              geonameId: 123,
              name: 'Berlin',
              countryName: 'Germany',
              countryCode: 'DE',
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const res = await app.inject({ method: 'GET', url: '/api/location/search?q=Berlin' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].city).toBe('Berlin');
  });

  it('returns postal code results from GeoNames', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          postalCodes: [
            {
              postalCode: '1012',
              placeName: 'Amsterdam',
              adminName1: 'North Holland',
              countryCode: 'NL',
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const res = await app.inject({ method: 'GET', url: '/api/location/search?q=1012&mode=postal' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toEqual({
      postalCode: '1012',
      city: 'Amsterdam',
      region: 'North Holland',
      country: 'NL',
      countryCode: 'NL',
      label: '1012, Amsterdam, North Holland, NL',
    });
  });

  it('returns country results from GeoNames', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          geonames: [
            {
              geonameId: 2750405,
              name: 'The Netherlands',
              countryName: 'The Netherlands',
              countryCode: 'NL',
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/location/search?q=Netherlands&mode=country',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toEqual({
      country: 'The Netherlands',
      countryCode: 'NL',
      label: 'The Netherlands',
    });
  });

  it('returns 502 with geonames_unavailable when GeoNames fails', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const res = await app.inject({
      method: 'GET',
      url: '/api/location/search?q=Amsterdam&mode=city',
    });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({ results: [], error: 'geonames_unavailable' });
  });

  it('returns 502 when GeoNames returns non-200', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(new Response('Service unavailable', { status: 503 }));

    const res = await app.inject({
      method: 'GET',
      url: '/api/location/search?q=Amsterdam&mode=city',
    });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({ results: [], error: 'geonames_unavailable' });
  });

  it('omits region from city result when adminName1 is absent', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          geonames: [
            {
              geonameId: 1,
              name: 'Singapore',
              countryName: 'Singapore',
              countryCode: 'SG',
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/location/search?q=Singapore&mode=city',
    });
    const body = res.json();
    expect(body.results[0].region).toBeUndefined();
    expect(body.results[0].label).toBe('Singapore, Singapore');
  });
});
