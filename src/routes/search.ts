import type { FastifyInstance } from 'fastify';
import type { Database } from '../db/index.js';
import { sql } from 'drizzle-orm';

export function registerSearchRoutes(app: FastifyInstance, db: Database) {
  app.get('/api/search/profiles', async (request, reply) => {
    const { q, limit = '20', offset = '0' } = request.query as Record<string, string>;
    if (!q?.trim()) {
      return reply.status(400).send({ error: 'InvalidRequest', message: 'Query parameter q is required' });
    }

    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    const offsetNum = parseInt(offset, 10) || 0;

    const results = await db.execute(sql`
      SELECT did, handle, headline, about,
        ts_rank(
          to_tsvector('english', coalesce(handle, '') || ' ' || coalesce(headline, '') || ' ' || coalesce(about, '')),
          plainto_tsquery('english', ${q})
        ) as rank
      FROM profiles
      WHERE to_tsvector('english', coalesce(handle, '') || ' ' || coalesce(headline, '') || ' ' || coalesce(about, ''))
        @@ plainto_tsquery('english', ${q})
      ORDER BY rank DESC
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `);

    return { profiles: results.rows };
  });
}
