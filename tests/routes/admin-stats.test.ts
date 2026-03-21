import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Fastify from 'fastify';
import type { ValkeyClient } from '../../src/cache/index.js';
import type { Env } from '../../src/config.js';

// We'll test the route by mocking the DB at the module level
// and intercepting the Drizzle calls.

vi.mock('../../src/middleware/auth.js', () => ({
  createAuthMiddleware: () => async (request: FastifyRequest, _reply: FastifyReply) => {
    request.did = 'did:plc:admin1';
  },
}));

vi.mock('../../src/middleware/admin.js', () => ({
  createAdminMiddleware: () => async (_request: FastifyRequest, _reply: FastifyReply) => {
    // pass through
  },
}));

// Track DB query results
let dbQueryResults: unknown[][] = [];
let dbQueryIndex = 0;

// Create a chainable mock that resolves to the next result in dbQueryResults
function createChain(): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  const methods = ['from', 'where', 'groupBy', 'orderBy', 'limit', 'as'];
  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  // Make it awaitable
  chain.then = (resolve: (value: unknown) => void, _reject?: (reason: unknown) => void) => {
    const result = dbQueryResults[dbQueryIndex] ?? [];
    dbQueryIndex++;
    resolve(result);
    return Promise.resolve(result);
  };
  return chain;
}

function makeDb() {
  return {
    select: vi.fn().mockImplementation(() => createChain()),
  };
}

function makeConfig(overrides?: Partial<Env>): Env {
  return {
    NODE_ENV: 'test',
    PORT: 3100,
    PUBLIC_URL: 'http://localhost:3100',
    DATABASE_URL: 'postgresql://localhost/test',
    VALKEY_URL: 'redis://localhost:6379',
    SIFA_DID: 'did:plc:test',
    JETSTREAM_URL: 'wss://jetstream.example.com',
    OAUTH_JWKS_PATH: '/tmp/jwks',
    GEONAMES_USERNAME: 'test',
    ADMIN_DIDS: 'did:plc:admin1',
    ...overrides,
  };
}

function createMockValkey(cachedValue?: string): ValkeyClient {
  return {
    get: vi.fn().mockResolvedValue(cachedValue ?? null),
    setex: vi.fn().mockResolvedValue('OK'),
  } as unknown as ValkeyClient;
}

describe('Admin stats signups endpoint', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    app.decorateRequest('did', null);
    app.decorateRequest('oauthSession', null);
    dbQueryIndex = 0;
    dbQueryResults = [];
  });

  it('GET /api/admin/stats/signups returns signup data with gap-filled dates', async () => {
    // Query order: 1) total count, 2) signup rows, 3) prior count
    dbQueryResults = [
      [{ value: 42 }], // total
      [
        { date: '2026-03-14', count: 3 },
        { date: '2026-03-15', count: 2 },
      ], // signups
      [{ value: 37 }], // prior count
    ];
    const db = makeDb();

    const { registerAdminStatsRoutes } = await import('../../src/routes/admin-stats.js');
    registerAdminStatsRoutes(app, db as never, null, null, makeConfig());

    const res = await app.inject({ method: 'GET', url: '/api/admin/stats/signups' });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.totalUsers).toBe(42);
    // Should have all 31 days (today - 30 days through today), not just 2
    expect(body.signups.length).toBeGreaterThan(2);
    const mar14 = body.signups.find((s: { date: string }) => s.date === '2026-03-14');
    const mar15 = body.signups.find((s: { date: string }) => s.date === '2026-03-15');
    expect(mar14).toEqual({ date: '2026-03-14', count: 3, cumulative: 40 });
    expect(mar15).toEqual({ date: '2026-03-15', count: 2, cumulative: 42 });
    // Zero-count days should exist with count 0
    const mar13 = body.signups.find((s: { date: string }) => s.date === '2026-03-13');
    expect(mar13).toBeDefined();
    expect(mar13.count).toBe(0);
  });

  it('GET /api/admin/stats/signups?days=0 returns all-time data with gap-filled dates', async () => {
    // days=0: 1) total count, 2) signup rows (no prior count query)
    dbQueryResults = [
      [{ value: 30 }],
      [
        { date: '2026-03-05', count: 10 },
        { date: '2026-03-10', count: 20 },
      ],
    ];
    const db = makeDb();

    const { registerAdminStatsRoutes } = await import('../../src/routes/admin-stats.js');
    registerAdminStatsRoutes(app, db as never, null, null, makeConfig());

    const res = await app.inject({ method: 'GET', url: '/api/admin/stats/signups?days=0' });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.totalUsers).toBe(30);
    // Should have all dates from launch (Mar 4) to today, not just 2
    expect(body.signups.length).toBeGreaterThan(2);
    const mar5 = body.signups.find((s: { date: string }) => s.date === '2026-03-05');
    const mar10 = body.signups.find((s: { date: string }) => s.date === '2026-03-10');
    expect(mar5).toEqual({ date: '2026-03-05', count: 10, cumulative: 10 });
    expect(mar10).toEqual({ date: '2026-03-10', count: 20, cumulative: 30 });
    // First entry should be site launch date
    expect(body.signups[0].date).toBe('2026-03-04');
  });

  it('rejects invalid days parameter', async () => {
    dbQueryResults = [];
    const db = makeDb();

    const { registerAdminStatsRoutes } = await import('../../src/routes/admin-stats.js');
    registerAdminStatsRoutes(app, db as never, null, null, makeConfig());

    const res = await app.inject({ method: 'GET', url: '/api/admin/stats/signups?days=15' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Invalid query');
  });

  it('returns cached response from Valkey', async () => {
    const cachedResponse = JSON.stringify({
      totalUsers: 10,
      signups: [{ date: '2026-03-14', count: 10, cumulative: 10 }],
    });
    const db = makeDb();
    const valkey = createMockValkey(cachedResponse);

    const { registerAdminStatsRoutes } = await import('../../src/routes/admin-stats.js');
    registerAdminStatsRoutes(app, db as never, valkey, null, makeConfig());

    const res = await app.inject({ method: 'GET', url: '/api/admin/stats/signups' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(JSON.parse(cachedResponse));
    expect(valkey.get).toHaveBeenCalledWith('admin:stats:signups:30');
  });

  it('caches response in Valkey when not cached', async () => {
    dbQueryResults = [[{ value: 5 }], [{ date: '2026-03-15', count: 5 }], [{ value: 0 }]];
    const db = makeDb();
    const valkey = createMockValkey();

    const { registerAdminStatsRoutes } = await import('../../src/routes/admin-stats.js');
    registerAdminStatsRoutes(app, db as never, valkey, null, makeConfig());

    const res = await app.inject({ method: 'GET', url: '/api/admin/stats/signups?days=7' });
    expect(res.statusCode).toBe(200);
    expect(valkey.setex).toHaveBeenCalledWith('admin:stats:signups:7', 300, expect.any(String));
  });

  it('accepts days=7, days=90, days=0 as valid', async () => {
    const db = makeDb();

    const { registerAdminStatsRoutes } = await import('../../src/routes/admin-stats.js');
    registerAdminStatsRoutes(app, db as never, null, null, makeConfig());

    for (const days of ['7', '90', '0']) {
      dbQueryIndex = 0;
      dbQueryResults = [[{ value: 0 }], [], [{ value: 0 }]];
      const res = await app.inject({ method: 'GET', url: `/api/admin/stats/signups?days=${days}` });
      expect(res.statusCode).toBe(200);
    }
  });
});

describe('Admin stats user-locations endpoint', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    app.decorateRequest('did', null);
    app.decorateRequest('oauthSession', null);
    dbQueryIndex = 0;
    dbQueryResults = [];
  });

  it('GET /api/admin/stats/user-locations returns aggregated location points', async () => {
    dbQueryResults = [
      [
        { countryCode: 'NL', locationCountry: 'Netherlands', locationCity: 'Amsterdam', count: 5 },
        { countryCode: 'NL', locationCountry: 'Netherlands', locationCity: null, count: 3 },
        { countryCode: 'US', locationCountry: 'United States', locationCity: 'New York', count: 2 },
      ],
    ];
    const db = makeDb();

    const { registerAdminStatsRoutes } = await import('../../src/routes/admin-stats.js');
    registerAdminStatsRoutes(app, db as never, null, null, makeConfig());

    const res = await app.inject({ method: 'GET', url: '/api/admin/stats/user-locations' });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.locations).toHaveLength(3);
    // Sorted by count descending
    expect(body.locations[0].count).toBe(5);
    expect(body.locations[0].label).toBe('Amsterdam, Netherlands');
    expect(body.locations[1].count).toBe(3);
    expect(body.locations[1].label).toBe('Netherlands');
    expect(body.locations[2].count).toBe(2);
    expect(body.locations[2].label).toBe('New York, United States');
    // All should have coordinates
    for (const loc of body.locations) {
      expect(typeof loc.lat).toBe('number');
      expect(typeof loc.lng).toBe('number');
    }
  });

  it('skips profiles with unknown country codes', async () => {
    dbQueryResults = [
      [
        { countryCode: 'XX', locationCountry: 'Unknown', locationCity: null, count: 1 },
        { countryCode: 'DE', locationCountry: 'Germany', locationCity: null, count: 2 },
      ],
    ];
    const db = makeDb();

    const { registerAdminStatsRoutes } = await import('../../src/routes/admin-stats.js');
    registerAdminStatsRoutes(app, db as never, null, null, makeConfig());

    const res = await app.inject({ method: 'GET', url: '/api/admin/stats/user-locations' });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.locations).toHaveLength(1);
    expect(body.locations[0].label).toBe('Germany');
  });

  it('resolves country from name when country_code is null', async () => {
    dbQueryResults = [
      [
        { countryCode: null, locationCountry: 'Deutschland', locationCity: 'Köln', count: 1 },
        { countryCode: null, locationCountry: 'Switzerland', locationCity: 'Zürich', count: 1 },
        { countryCode: null, locationCountry: 'Schweiz', locationCity: null, count: 1 },
        { countryCode: null, locationCountry: 'Oslo, Oslo, Norway', locationCity: null, count: 1 },
        {
          countryCode: null,
          locationCountry: 'Helsinki Metropolitan Area',
          locationCity: null,
          count: 1,
        },
      ],
    ];
    const db = makeDb();

    const { registerAdminStatsRoutes } = await import('../../src/routes/admin-stats.js');
    registerAdminStatsRoutes(app, db as never, null, null, makeConfig());

    const res = await app.inject({ method: 'GET', url: '/api/admin/stats/user-locations' });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    const labels = body.locations.map((l: { label: string }) => l.label);
    // Deutschland -> DE, Switzerland -> CH, Schweiz -> CH
    expect(labels).toContain('Köln, Deutschland');
    expect(labels).toContain('Zürich, Switzerland');
    // Schweiz resolves to CH same as Switzerland
    expect(labels).toContain('Schweiz');
    // "Oslo, Oslo, Norway" should resolve Norway -> NO
    expect(labels).toContain('Oslo, Oslo, Norway');
    // "Helsinki Metropolitan Area" has no country match, should be skipped
    expect(labels).not.toContain('Helsinki Metropolitan Area');
  });

  it('returns cached response from Valkey', async () => {
    const cachedResponse = JSON.stringify({
      locations: [{ lat: 52.13, lng: 5.29, count: 10, label: 'Netherlands' }],
    });
    const db = makeDb();
    const valkey = createMockValkey(cachedResponse);

    const { registerAdminStatsRoutes } = await import('../../src/routes/admin-stats.js');
    registerAdminStatsRoutes(app, db as never, valkey, null, makeConfig());

    const res = await app.inject({ method: 'GET', url: '/api/admin/stats/user-locations' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(JSON.parse(cachedResponse));
    expect(valkey.get).toHaveBeenCalledWith('admin:stats:user-locations');
  });
});
