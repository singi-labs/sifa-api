import { count } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Database } from '../db/index.js';
import type { ValkeyClient } from '../cache/index.js';
import { profiles } from '../db/schema/index.js';

const CACHE_KEY = 'stats:profile-count';
const CACHE_TTL = 900; // 15 minutes

export function registerStatsRoutes(
  app: FastifyInstance,
  db: Database,
  valkey: ValkeyClient | null,
) {
  app.get('/api/stats', async (_request, reply) => {
    if (valkey) {
      const cached = await valkey.get(CACHE_KEY);
      if (cached !== null) {
        return reply.send({ profileCount: Number(cached) });
      }
    }

    const [result] = await db.select({ value: count() }).from(profiles);
    const profileCount = result?.value ?? 0;

    if (valkey) {
      await valkey.setex(CACHE_KEY, CACHE_TTL, String(profileCount));
    }

    return reply.send({ profileCount });
  });
}
