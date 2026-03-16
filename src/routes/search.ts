import type { FastifyInstance } from 'fastify';
import type { Database } from '../db/index.js';
import { sql } from 'drizzle-orm';

export function registerSearchRoutes(app: FastifyInstance, db: Database) {
  app.get('/api/search/profiles', async (request, reply) => {
    const { q, limit = '20', offset = '0' } = request.query as Record<string, string>;
    if (!q?.trim()) {
      return reply
        .status(400)
        .send({ error: 'InvalidRequest', message: 'Query parameter q is required' });
    }

    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    const offsetNum = parseInt(offset, 10) || 0;

    // Raw SQL required: Drizzle ORM doesn't support full-text search with to_tsvector/plainto_tsquery
    const results = await db.execute(sql`
      SELECT p.did, p.handle, p.display_name AS "displayName",
        p.avatar_url AS "avatarUrl", p.headline, p.about,
        pos.title AS "currentRole",
        pos.company_name AS "currentCompany",
        ts_rank(
          to_tsvector('english', coalesce(p.display_name, '') || ' ' || coalesce(p.handle, '') || ' ' || coalesce(p.headline, '') || ' ' || coalesce(p.about, '')),
          plainto_tsquery('english', ${q})
        ) as rank
      FROM profiles p
      LEFT JOIN positions pos ON p.did = pos.did AND pos.current = true
      WHERE to_tsvector('english', coalesce(p.display_name, '') || ' ' || coalesce(p.handle, '') || ' ' || coalesce(p.headline, '') || ' ' || coalesce(p.about, ''))
        @@ plainto_tsquery('english', ${q})
      ORDER BY rank DESC
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `);

    return {
      profiles: results.rows.map((row) => {
        const r = row as Record<string, unknown>;
        const profile: Record<string, unknown> = {
          did: r.did,
          handle: r.handle,
          headline: r.headline,
          about: r.about,
        };
        if (r.displayName != null) profile.displayName = r.displayName;
        if (r.avatarUrl != null) profile.avatar = r.avatarUrl;
        if (r.currentRole != null) profile.currentRole = r.currentRole;
        if (r.currentCompany != null) profile.currentCompany = r.currentCompany;
        return profile;
      }),
    };
  });
}
