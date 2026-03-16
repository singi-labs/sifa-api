import { count, desc, sql, gte } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import type { Database } from '../db/index.js';
import type { ValkeyClient } from '../cache/index.js';
import type { Env } from '../config.js';
import { profiles } from '../db/schema/index.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { createAdminMiddleware } from '../middleware/admin.js';

const CACHE_TTL = 300; // 5 minutes

const querySchema = z.object({
  days: z.enum(['7', '30', '90', '0']).default('30'),
});

const latestSignupsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
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
      const signups: SignupEntry[] = signupRows.map((row) => {
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

      const { limit } = parsed.data;
      const cacheKey = `admin:stats:latest-signups:${limit}`;

      if (valkey) {
        const cached = await valkey.get(cacheKey);
        if (cached !== null) {
          return reply.send(JSON.parse(cached));
        }
      }

      const rows = await db
        .select({
          did: profiles.did,
          handle: profiles.handle,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
          createdAt: profiles.createdAt,
        })
        .from(profiles)
        .orderBy(desc(profiles.createdAt))
        .limit(limit);

      const users = rows.map((r) => ({
        did: r.did,
        handle: r.handle,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
        createdAt: r.createdAt.toISOString(),
      }));

      const response = { users };

      if (valkey) {
        await valkey.setex(cacheKey, CACHE_TTL, JSON.stringify(response));
      }

      return reply.send(response);
    },
  );
}
