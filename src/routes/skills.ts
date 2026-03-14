import type { FastifyInstance } from 'fastify';
import type { Database } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

const searchQuerySchema = z.object({
  q: z.string().min(1, 'Query parameter q is required'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export function registerSkillsRoutes(app: FastifyInstance, db: Database) {
  app.get('/api/skills/search', {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const parsed = searchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'InvalidRequest',
        message: parsed.error.issues[0]?.message ?? 'Invalid query parameters',
      });
    }

    const { q, limit } = parsed.data;
    const searchTerm = q.trim().toLowerCase();

    if (!searchTerm) {
      return reply.status(400).send({
        error: 'InvalidRequest',
        message: 'Query parameter q is required',
      });
    }

    // Search canonical_name with pg_trgm similarity + exact slug match + alias array matching
    // Order: exact slug match first, then by (similarity * log(user_count + 2)) for weighted ranking
    // Wrapped in subquery so column aliases (sim, exact_match) can be used in ORDER BY
    const results = await db.execute(sql`
      SELECT canonical_name, slug, category FROM (
        SELECT canonical_name, slug, category,
          CASE WHEN slug = ${searchTerm} THEN 1 ELSE 0 END AS exact_match,
          GREATEST(
            similarity(lower(canonical_name), ${searchTerm}),
            (SELECT COALESCE(MAX(similarity(lower(alias), ${searchTerm})), 0)
             FROM unnest(aliases) AS alias)
          ) AS sim,
          user_count
        FROM canonical_skills
        WHERE lower(canonical_name) % ${searchTerm}
           OR canonical_name ILIKE ${'%' + searchTerm + '%'}
           OR slug = ${searchTerm}
           OR EXISTS (
             SELECT 1 FROM unnest(aliases) AS alias
             WHERE lower(alias) % ${searchTerm} OR lower(alias) ILIKE ${'%' + searchTerm + '%'}
           )
      ) AS matched
      ORDER BY exact_match DESC, sim * ln(user_count + 2) DESC, sim DESC
      LIMIT ${limit}
    `);

    return {
      skills: results.rows.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          canonicalName: r.canonical_name as string,
          slug: r.slug as string,
          category: r.category as string,
        };
      }),
    };
  });
}
