import type { FastifyInstance } from 'fastify';
import type { Database } from '../db/index.js';
import { sql } from 'drizzle-orm';

export function registerSkillsRoutes(app: FastifyInstance, db: Database) {
  app.get('/api/skills/search', async (request, reply) => {
    const { q, limit = '20' } = request.query as Record<string, string>;
    if (!q?.trim()) {
      return reply
        .status(400)
        .send({ error: 'InvalidRequest', message: 'Query parameter q is required' });
    }

    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    const searchTerm = q.trim().toLowerCase();

    // Search canonical_name with pg_trgm similarity + alias array matching
    // Order by similarity score first, then user_count for tie-breaking
    const results = await db.execute(sql`
      SELECT id, canonical_name, slug, category, user_count,
        GREATEST(
          similarity(lower(canonical_name), ${searchTerm}),
          (SELECT COALESCE(MAX(similarity(alias, ${searchTerm})), 0)
           FROM unnest(aliases) AS alias)
        ) AS sim
      FROM canonical_skills
      WHERE lower(canonical_name) % ${searchTerm}
         OR canonical_name ILIKE ${'%' + searchTerm + '%'}
         OR EXISTS (
           SELECT 1 FROM unnest(aliases) AS alias
           WHERE alias % ${searchTerm} OR alias ILIKE ${'%' + searchTerm + '%'}
         )
      ORDER BY sim DESC, user_count DESC
      LIMIT ${limitNum}
    `);

    return {
      skills: results.rows.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          id: r.id,
          canonicalName: r.canonical_name,
          slug: r.slug,
          category: r.category,
          userCount: r.user_count,
        };
      }),
    };
  });
}
