import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { buildServer } from '../../src/server.js';
import { createDb } from '../../src/db/index.js';
import { profiles, positions } from '../../src/db/schema/index.js';
import { sql } from 'drizzle-orm';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

vi.mock('../../src/services/handle-resolver.js', () => ({
  resolveHandleFromNetwork: vi.fn().mockResolvedValue(null),
}));

describe('Search API', () => {
  let app: FastifyInstance;
  const db = createDb(process.env.DATABASE_URL ?? 'postgresql://sifa:sifa@localhost:5432/sifa');
  const tmpKeysDir = join(tmpdir(), `sifa-test-keys-search-${Date.now()}`);
  const jwksPath = join(tmpKeysDir, 'jwks.json');

  beforeAll(async () => {
    mkdirSync(tmpKeysDir, { recursive: true });
    writeFileSync(jwksPath, JSON.stringify({ keys: [{ kty: 'EC', crv: 'P-256', kid: 'test' }] }));

    await db
      .insert(profiles)
      .values({
        did: 'did:plc:search-test',
        handle: 'searchtest.bsky.social',
        displayName: 'Alice Wonderland',
        avatarUrl: 'https://cdn.bsky.app/img/avatar/did:plc:search-test/test.jpg',
        headline: 'Senior TypeScript Developer',
        about: 'Building distributed systems',
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    // Profile with a current position
    await db
      .insert(profiles)
      .values({
        did: 'did:plc:search-with-role',
        handle: 'searchwithrole.bsky.social',
        displayName: 'Erlend Sogge Heggen',
        headline: 'TypeScript Engineer',
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(positions)
      .values({
        did: 'did:plc:search-with-role',
        rkey: '3searchpos',
        companyName: 'Acme Corp',
        title: 'Staff Engineer',
        startDate: '2023-01',
        current: true,
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    app = await buildServer({
      NODE_ENV: 'test',
      PORT: 0,
      PUBLIC_URL: 'http://localhost:3100',
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://sifa:sifa@localhost:5432/sifa',
      VALKEY_URL: 'redis://localhost:6379',
      SIFA_DID: 'did:plc:test',
      JETSTREAM_URL: 'wss://jetstream1.us-east.bsky.network/subscribe',
      OAUTH_JWKS_PATH: jwksPath,
    });
  });

  afterAll(async () => {
    await db.execute(sql`DELETE FROM positions WHERE did = 'did:plc:search-with-role'`);
    await db.execute(
      sql`DELETE FROM profiles WHERE did IN ('did:plc:search-test', 'did:plc:search-with-role')`,
    );
    await db.$client.end();
    await app.close();
    rmSync(tmpKeysDir, { recursive: true });
  });

  it('GET /api/search/profiles returns matching results', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search/profiles?q=TypeScript' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.profiles.length).toBeGreaterThanOrEqual(1);
    expect(body.profiles.some((p: { did: string }) => p.did === 'did:plc:search-test')).toBe(true);
  });

  it('GET /api/search/profiles returns 400 without query', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search/profiles' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('InvalidRequest');
  });

  it('GET /api/search/profiles returns empty for no matches', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/search/profiles?q=xyznonexistent999',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().profiles).toHaveLength(0);
  });

  it('GET /api/search/profiles respects limit parameter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/search/profiles?q=TypeScript&limit=1',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().profiles.length).toBeLessThanOrEqual(1);
  });

  it('GET /api/search/profiles returns 400 for empty query string', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search/profiles?q=' });
    expect(res.statusCode).toBe(400);
  });

  it('includes currentRole and currentCompany when profile has a current position', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search/profiles?q=TypeScript' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const withRole = body.profiles.find(
      (p: { did: string }) => p.did === 'did:plc:search-with-role',
    );
    expect(withRole).toBeDefined();
    expect(withRole.currentRole).toBe('Staff Engineer');
    expect(withRole.currentCompany).toBe('Acme Corp');
  });

  it('omits currentRole and currentCompany when profile has no current position', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search/profiles?q=TypeScript' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const noRole = body.profiles.find((p: { did: string }) => p.did === 'did:plc:search-test');
    expect(noRole).toBeDefined();
    expect(noRole.currentRole).toBeUndefined();
    expect(noRole.currentCompany).toBeUndefined();
  });

  it('finds profile by display name', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search/profiles?q=Erlend' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.profiles.some((p: { did: string }) => p.did === 'did:plc:search-with-role')).toBe(
      true,
    );
  });

  it('returns displayName and avatar in results', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search/profiles?q=TypeScript' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const alice = body.profiles.find((p: { did: string }) => p.did === 'did:plc:search-test');
    expect(alice).toBeDefined();
    expect(alice.displayName).toBe('Alice Wonderland');
    expect(alice.avatar).toBe('https://cdn.bsky.app/img/avatar/did:plc:search-test/test.jpg');
  });

  it('omits displayName and avatar when null', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search/profiles?q=Erlend' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const erlend = body.profiles.find((p: { did: string }) => p.did === 'did:plc:search-with-role');
    expect(erlend).toBeDefined();
    expect(erlend.avatar).toBeUndefined();
  });

  it('does not leak rank field in response', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search/profiles?q=TypeScript' });
    const body = res.json();
    for (const profile of body.profiles) {
      expect(profile.rank).toBeUndefined();
    }
  });

  it('DB results include claimed: true', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search/profiles?q=TypeScript' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.profiles.length).toBeGreaterThanOrEqual(1);
    for (const profile of body.profiles) {
      expect(profile.claimed).toBe(true);
    }
  });

  describe('AT Protocol handle resolution fallback', () => {
    let handleResolverMock: typeof import('../../src/services/handle-resolver.js');

    beforeEach(async () => {
      handleResolverMock = await import('../../src/services/handle-resolver.js');
      vi.mocked(handleResolverMock.resolveHandleFromNetwork).mockReset();
      vi.mocked(handleResolverMock.resolveHandleFromNetwork).mockResolvedValue(null);
    });

    it('resolves AT Protocol handle when DB has no results and returns claimed: false', async () => {
      vi.mocked(handleResolverMock.resolveHandleFromNetwork).mockResolvedValue({
        did: 'did:plc:network-resolved',
        handle: 'networkuser.bsky.social',
        displayName: 'Network User',
        avatar: 'https://cdn.bsky.app/img/avatar/network.jpg',
        about: 'Found via network',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/search/profiles?q=networkuser.bsky.social',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.profiles.length).toBe(1);
      const profile = body.profiles[0];
      expect(profile.did).toBe('did:plc:network-resolved');
      expect(profile.handle).toBe('networkuser.bsky.social');
      expect(profile.displayName).toBe('Network User');
      expect(profile.avatar).toBe('https://cdn.bsky.app/img/avatar/network.jpg');
      expect(profile.about).toBe('Found via network');
      expect(profile.claimed).toBe(false);
    });

    it('returns empty when handle resolution also fails', async () => {
      vi.mocked(handleResolverMock.resolveHandleFromNetwork).mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: '/api/search/profiles?q=doesnotexist.bsky.social',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().profiles).toHaveLength(0);
    });

    it('short queries without dots get .bsky.social appended via resolver', async () => {
      vi.mocked(handleResolverMock.resolveHandleFromNetwork).mockResolvedValue({
        did: 'did:plc:short-handle',
        handle: 'shortname.bsky.social',
        displayName: 'Short Name',
        avatar: undefined,
        about: undefined,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/search/profiles?q=shortname',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      // The resolver was called with the query; it handles .bsky.social appending internally
      expect(vi.mocked(handleResolverMock.resolveHandleFromNetwork)).toHaveBeenCalledWith(
        'shortname',
      );
      const profile = body.profiles.find((p: { did: string }) => p.did === 'did:plc:short-handle');
      expect(profile).toBeDefined();
      expect(profile.claimed).toBe(false);
    });

    it('does not duplicate when handle resolves to DID already in DB', async () => {
      vi.mocked(handleResolverMock.resolveHandleFromNetwork).mockResolvedValue({
        did: 'did:plc:search-test',
        handle: 'searchtest.bsky.social',
        displayName: 'Alice Wonderland',
        avatar: 'https://cdn.bsky.app/img/avatar/did:plc:search-test/test.jpg',
        about: 'Building distributed systems',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/search/profiles?q=TypeScript',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      const aliceResults = body.profiles.filter(
        (p: { did: string }) => p.did === 'did:plc:search-test',
      );
      expect(aliceResults).toHaveLength(1);
      expect(aliceResults[0].claimed).toBe(true);
    });

    it('silently returns DB results when resolution throws', async () => {
      vi.mocked(handleResolverMock.resolveHandleFromNetwork).mockRejectedValue(
        new Error('Network error'),
      );

      const res = await app.inject({
        method: 'GET',
        url: '/api/search/profiles?q=TypeScript',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.profiles.length).toBeGreaterThanOrEqual(1);
    });
  });
});
