import { count, desc, sql, gte, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import type { Database } from '../db/index.js';
import type { ValkeyClient } from '../cache/index.js';
import type { Env } from '../config.js';
import {
  profiles,
  linkedinImports,
  positions,
  education,
  skills,
  certifications,
} from '../db/schema/index.js';
import { mapPdsHostToProvider } from '../lib/pds-provider.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { createAdminMiddleware } from '../middleware/admin.js';

const CACHE_TTL = 300; // 5 minutes

/** Generate all YYYY-MM-DD strings from startDate to endDate (inclusive). */
function allDatesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

/** Fill missing dates in a sparse array with a default record. */
function fillDateGaps<T extends { date: string }>(
  rows: T[],
  days: number,
  defaults: Omit<T, 'date'>,
): T[] {
  if (rows.length === 0 && days === 0) return rows;

  const today = new Date().toISOString().slice(0, 10);
  let startDate: string;
  if (days > 0) {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - days);
    startDate = start.toISOString().slice(0, 10);
  } else {
    const first = rows[0];
    startDate = first !== undefined ? first.date : today;
  }
  const endDate = today;

  const lookup = new Map(rows.map((r) => [r.date, r]));
  return allDatesBetween(startDate, endDate).map(
    (date) => lookup.get(date) ?? ({ date, ...defaults } as T),
  );
}

const querySchema = z.object({
  days: z.enum(['7', '30', '90', '0']).default('30'),
});

const latestSignupsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  filter: z.enum(['all', 'no-import']).default('all'),
});

interface SignupRow {
  date: string;
  count: number;
}

interface SignupEntry {
  date: string;
  count: number;
  cumulative: number;
}

interface SignupsResponse {
  totalUsers: number;
  signups: SignupEntry[];
}

export function registerAdminStatsRoutes(
  app: FastifyInstance,
  db: Database,
  valkey: ValkeyClient | null,
  oauthClient: NodeOAuthClient | null,
  config: Env,
) {
  const requireAuth = createAuthMiddleware(oauthClient, db);
  const requireAdmin = createAdminMiddleware(config);

  app.get(
    '/api/admin/stats/signups',
    { preHandler: [requireAuth, requireAdmin] },
    async (request, reply) => {
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query', details: parsed.error.format() });
      }

      const days = Number(parsed.data.days);
      const cacheKey = `admin:stats:signups:${days}`;

      // Check cache
      if (valkey) {
        const cached = await valkey.get(cacheKey);
        if (cached !== null) {
          return reply.send(JSON.parse(cached) as SignupsResponse);
        }
      }

      // Total user count (always all-time)
      const [totalResult] = await db.select({ value: count() }).from(profiles);
      const totalUsers = totalResult?.value ?? 0;

      // Signups grouped by date
      let signupRows: SignupRow[];
      if (days > 0) {
        const rows = await db
          .select({
            date: sql<string>`DATE(${profiles.createdAt})`.as('date'),
            count: count().as('count'),
          })
          .from(profiles)
          .where(gte(profiles.createdAt, sql`NOW() - INTERVAL '${sql.raw(String(days))} days'`))
          .groupBy(sql`DATE(${profiles.createdAt})`)
          .orderBy(sql`DATE(${profiles.createdAt})`);
        signupRows = rows.map((r) => ({ date: String(r.date), count: r.count }));
      } else {
        const rows = await db
          .select({
            date: sql<string>`DATE(${profiles.createdAt})`.as('date'),
            count: count().as('count'),
          })
          .from(profiles)
          .groupBy(sql`DATE(${profiles.createdAt})`)
          .orderBy(sql`DATE(${profiles.createdAt})`);
        signupRows = rows.map((r) => ({ date: String(r.date), count: r.count }));
      }

      // Fill in missing dates with zero counts
      const filledRows = fillDateGaps(signupRows, days, { count: 0 });

      // For windowed queries, get count of users before the window
      // so cumulative reflects the real total at each date
      let priorCount = 0;
      if (days > 0) {
        const [priorResult] = await db
          .select({ value: count() })
          .from(profiles)
          .where(sql`${profiles.createdAt} < NOW() - INTERVAL '${sql.raw(String(days))} days'`);
        priorCount = priorResult?.value ?? 0;
      }

      // Build cumulative
      let running = priorCount;
      const signups: SignupEntry[] = filledRows.map((row) => {
        running += row.count;
        return { date: row.date, count: row.count, cumulative: running };
      });

      const response: SignupsResponse = { totalUsers, signups };

      // Cache result
      if (valkey) {
        await valkey.setex(cacheKey, CACHE_TTL, JSON.stringify(response));
      }

      return reply.send(response);
    },
  );

  app.get(
    '/api/admin/stats/latest-signups',
    { preHandler: [requireAuth, requireAdmin] },
    async (request, reply) => {
      const parsed = latestSignupsSchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query', details: parsed.error.format() });
      }

      const { limit, offset, filter } = parsed.data;
      const cacheKey = `admin:stats:latest-signups:${filter}:${limit}:${offset}`;

      if (valkey) {
        const cached = await valkey.get(cacheKey);
        if (cached !== null) {
          return reply.send(JSON.parse(cached));
        }
      }

      // Subquery: count of successful LinkedIn imports per user
      const importCountSq = db
        .select({
          did: linkedinImports.did,
          cnt: count().as('import_cnt'),
        })
        .from(linkedinImports)
        .where(eq(linkedinImports.success, true))
        .groupBy(linkedinImports.did)
        .as('import_counts');

      // Subqueries for profile completion counts
      const posCountSq = db
        .select({
          did: positions.did,
          cnt: count().as('pos_cnt'),
        })
        .from(positions)
        .groupBy(positions.did)
        .as('pos_counts');

      const eduCountSq = db
        .select({
          did: education.did,
          cnt: count().as('edu_cnt'),
        })
        .from(education)
        .groupBy(education.did)
        .as('edu_counts');

      const skillCountSq = db
        .select({
          did: skills.did,
          cnt: count().as('skill_cnt'),
        })
        .from(skills)
        .groupBy(skills.did)
        .as('skill_counts');

      const certCountSq = db
        .select({
          did: certifications.did,
          cnt: count().as('cert_cnt'),
        })
        .from(certifications)
        .groupBy(certifications.did)
        .as('cert_counts');

      let query = db
        .select({
          did: profiles.did,
          handle: profiles.handle,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
          headline: profiles.headline,
          about: profiles.about,
          createdAt: profiles.createdAt,
          importCount: sql<number>`COALESCE(${importCountSq.cnt}, 0)`.as('import_count'),
          positionCount: sql<number>`COALESCE(${posCountSq.cnt}, 0)`.as('position_count'),
          educationCount: sql<number>`COALESCE(${eduCountSq.cnt}, 0)`.as('education_count'),
          skillCount: sql<number>`COALESCE(${skillCountSq.cnt}, 0)`.as('skill_count'),
          certificationCount: sql<number>`COALESCE(${certCountSq.cnt}, 0)`.as(
            'certification_count',
          ),
        })
        .from(profiles)
        .leftJoin(importCountSq, eq(profiles.did, importCountSq.did))
        .leftJoin(posCountSq, eq(profiles.did, posCountSq.did))
        .leftJoin(eduCountSq, eq(profiles.did, eduCountSq.did))
        .leftJoin(skillCountSq, eq(profiles.did, skillCountSq.did))
        .leftJoin(certCountSq, eq(profiles.did, certCountSq.did))
        .orderBy(desc(profiles.createdAt))
        .limit(limit)
        .offset(offset)
        .$dynamic();

      const noImportFilter = sql`${importCountSq.cnt} IS NULL AND (
            CASE WHEN ${profiles.headline} IS NOT NULL AND ${profiles.headline} != '' THEN 1 ELSE 0 END +
            CASE WHEN ${profiles.about} IS NOT NULL AND ${profiles.about} != '' THEN 1 ELSE 0 END +
            CASE WHEN ${posCountSq.cnt} IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN ${eduCountSq.cnt} IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN ${skillCountSq.cnt} IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN ${certCountSq.cnt} IS NOT NULL THEN 1 ELSE 0 END
          ) <= 3`;

      if (filter === 'no-import') {
        query = query.where(noImportFilter);
      }

      // Total count for pagination
      let totalCount: number;
      if (filter === 'no-import') {
        const [countResult] = await db
          .select({ value: count() })
          .from(profiles)
          .leftJoin(importCountSq, eq(profiles.did, importCountSq.did))
          .leftJoin(posCountSq, eq(profiles.did, posCountSq.did))
          .leftJoin(eduCountSq, eq(profiles.did, eduCountSq.did))
          .leftJoin(skillCountSq, eq(profiles.did, skillCountSq.did))
          .leftJoin(certCountSq, eq(profiles.did, certCountSq.did))
          .where(noImportFilter);
        totalCount = countResult?.value ?? 0;
      } else {
        const [countResult] = await db.select({ value: count() }).from(profiles);
        totalCount = countResult?.value ?? 0;
      }

      const rows = await query;

      const users = rows.map((r) => ({
        did: r.did,
        handle: r.handle,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
        createdAt: r.createdAt.toISOString(),
        hasImported: Number(r.importCount) > 0,
        profileCompletion: {
          hasHeadline: !!r.headline,
          hasAbout: !!r.about,
          positionCount: Number(r.positionCount),
          educationCount: Number(r.educationCount),
          skillCount: Number(r.skillCount),
          certificationCount: Number(r.certificationCount),
        },
      }));

      const response = { users, total: totalCount };

      if (valkey) {
        await valkey.setex(cacheKey, CACHE_TTL, JSON.stringify(response));
      }

      return reply.send(response);
    },
  );

  app.get(
    '/api/admin/stats/active-users',
    { preHandler: [requireAuth, requireAdmin] },
    async (request, reply) => {
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query', details: parsed.error.format() });
      }

      const days = Number(parsed.data.days);
      const cacheKey = `admin:stats:active-users:${days}`;

      if (valkey) {
        const cached = await valkey.get(cacheKey);
        if (cached !== null) {
          return reply.send(JSON.parse(cached));
        }
      }

      // DAU: count distinct users active per day
      const dauDays = days > 0 ? days : 90;
      const dauRows = await db
        .select({
          date: sql<string>`DATE(${profiles.lastActiveAt})`.as('date'),
          count: count().as('count'),
        })
        .from(profiles)
        .where(
          sql`${profiles.lastActiveAt} IS NOT NULL AND ${profiles.lastActiveAt} >= NOW() - INTERVAL '${sql.raw(String(dauDays))} days'`,
        )
        .groupBy(sql`DATE(${profiles.lastActiveAt})`)
        .orderBy(sql`DATE(${profiles.lastActiveAt})`);

      const dailySparse = dauRows.map((r) => ({ date: String(r.date), count: r.count }));
      const daily = fillDateGaps(dailySparse, dauDays, { count: 0 });

      // MAU: count distinct users active per month (last 12 months max)
      const mauRows = await db
        .select({
          month: sql<string>`TO_CHAR(${profiles.lastActiveAt}, 'YYYY-MM')`.as('month'),
          count: count().as('count'),
        })
        .from(profiles)
        .where(
          sql`${profiles.lastActiveAt} IS NOT NULL AND ${profiles.lastActiveAt} >= NOW() - INTERVAL '12 months'`,
        )
        .groupBy(sql`TO_CHAR(${profiles.lastActiveAt}, 'YYYY-MM')`)
        .orderBy(sql`TO_CHAR(${profiles.lastActiveAt}, 'YYYY-MM')`);

      const monthly = mauRows.map((r) => ({ month: String(r.month), count: r.count }));

      const response = { daily, monthly };

      if (valkey) {
        await valkey.setex(cacheKey, CACHE_TTL, JSON.stringify(response));
      }

      return reply.send(response);
    },
  );

  app.get(
    '/api/admin/stats/pds-distribution',
    { preHandler: [requireAuth, requireAdmin] },
    async (_request, reply) => {
      const cacheKey = 'admin:stats:pds-distribution';

      if (valkey) {
        const cached = await valkey.get(cacheKey);
        if (cached !== null) {
          return reply.send(JSON.parse(cached));
        }
      }

      const rows = await db
        .select({
          pdsHost: profiles.pdsHost,
          count: count().as('count'),
        })
        .from(profiles)
        .where(sql`${profiles.pdsHost} IS NOT NULL`)
        .groupBy(profiles.pdsHost);

      // Group using known provider mapping: bluesky, eurosky, etc. → display name; selfhosted → "Self-hosted"
      const PROVIDER_LABELS: Record<string, string> = {
        bluesky: 'Bluesky',
        blacksky: 'Blacksky',
        eurosky: 'Eurosky',
        northsky: 'Northsky',
        'selfhosted-social': 'selfhosted.social',
        selfhosted: 'Self-hosted',
      };
      const groups = new Map<string, number>();
      for (const row of rows) {
        const host = row.pdsHost ?? '';
        const provider = mapPdsHostToProvider(host);
        const label = PROVIDER_LABELS[provider.name] ?? provider.name;
        groups.set(label, (groups.get(label) ?? 0) + row.count);
      }

      const slices = Array.from(groups.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      const response = { slices };

      if (valkey) {
        await valkey.setex(cacheKey, CACHE_TTL, JSON.stringify(response));
      }

      return reply.send(response);
    },
  );

  app.get(
    '/api/admin/stats/linkedin-imports',
    { preHandler: [requireAuth, requireAdmin] },
    async (request, reply) => {
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query', details: parsed.error.format() });
      }

      const days = Number(parsed.data.days);
      const cacheKey = `admin:stats:linkedin-imports:${days}`;

      if (valkey) {
        const cached = await valkey.get(cacheKey);
        if (cached !== null) {
          return reply.send(JSON.parse(cached));
        }
      }

      const importDays = days > 0 ? days : 90;
      const rows = await db
        .select({
          date: sql<string>`DATE(${linkedinImports.createdAt})`.as('date'),
          successCount: sql<number>`COUNT(*) FILTER (WHERE ${linkedinImports.success} = true)`.as(
            'success_count',
          ),
          failureCount: sql<number>`COUNT(*) FILTER (WHERE ${linkedinImports.success} = false)`.as(
            'failure_count',
          ),
          totalItems: sql<number>`COALESCE(SUM(
            ${linkedinImports.positionCount} + ${linkedinImports.educationCount} +
            ${linkedinImports.skillCount} + ${linkedinImports.certificationCount} +
            ${linkedinImports.projectCount} + ${linkedinImports.volunteeringCount} +
            ${linkedinImports.publicationCount} + ${linkedinImports.courseCount} +
            ${linkedinImports.honorCount} + ${linkedinImports.languageCount}
          ), 0)`.as('total_items'),
        })
        .from(linkedinImports)
        .where(
          sql`${linkedinImports.createdAt} >= NOW() - INTERVAL '${sql.raw(String(importDays))} days'`,
        )
        .groupBy(sql`DATE(${linkedinImports.createdAt})`)
        .orderBy(sql`DATE(${linkedinImports.createdAt})`);

      const dailySparse = rows.map((r) => ({
        date: String(r.date),
        successCount: Number(r.successCount),
        failureCount: Number(r.failureCount),
        totalItems: Number(r.totalItems),
      }));
      const daily = fillDateGaps(dailySparse, importDays, {
        successCount: 0,
        failureCount: 0,
        totalItems: 0,
      });

      const totalImports = daily.reduce((s, d) => s + d.successCount + d.failureCount, 0);
      const totalSuccess = daily.reduce((s, d) => s + d.successCount, 0);
      const totalItems = daily.reduce((s, d) => s + d.totalItems, 0);
      const successRate = totalImports > 0 ? Math.round((totalSuccess / totalImports) * 100) : 0;

      const response = { daily, summary: { totalImports, totalSuccess, totalItems, successRate } };

      if (valkey) {
        await valkey.setex(cacheKey, CACHE_TTL, JSON.stringify(response));
      }

      return reply.send(response);
    },
  );
}
