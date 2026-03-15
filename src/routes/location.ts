import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const GEONAMES_BASE = 'https://secure.geonames.org';

const querySchema = z.object({
  q: z.string().optional(),
  mode: z.enum(['city', 'postal', 'country']).default('city'),
});

interface GeoNameResult {
  geonameId: number;
  name: string;
  adminName1?: string;
  countryName: string;
  countryCode: string;
}

interface PostalCodeResult {
  postalCode: string;
  placeName: string;
  adminName1?: string;
  countryCode: string;
}

export function registerLocationRoutes(app: FastifyInstance, geonamesUsername: string) {
  app.get('/api/location/search', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(200).send({ results: [] });
    }

    const { q, mode } = parsed.data;
    if (!q || q.trim().length < 2) {
      return reply.status(200).send({ results: [] });
    }

    const query = q.trim();

    try {
      if (mode === 'city') {
        const res = await fetch(
          `${GEONAMES_BASE}/searchJSON?q=${encodeURIComponent(query)}&maxRows=8&featureClass=P&style=medium&username=${geonamesUsername}`,
        );
        if (!res.ok) throw new Error(`GeoNames responded ${res.status}`);
        const data = (await res.json()) as { geonames?: GeoNameResult[] };
        const results = (data.geonames ?? []).map((g) => ({
          city: g.name,
          region: g.adminName1 || undefined,
          country: g.countryName,
          countryCode: g.countryCode,
          geonameId: g.geonameId,
          label: [g.name, g.adminName1, g.countryName].filter(Boolean).join(', '),
        }));
        return reply.send({ results });
      }

      if (mode === 'postal') {
        const res = await fetch(
          `${GEONAMES_BASE}/postalCodeSearchJSON?postalcode=${encodeURIComponent(query)}&maxRows=8&username=${geonamesUsername}`,
        );
        if (!res.ok) throw new Error(`GeoNames responded ${res.status}`);
        const data = (await res.json()) as { postalCodes?: PostalCodeResult[] };
        const results = (data.postalCodes ?? []).map((p) => ({
          postalCode: p.postalCode,
          city: p.placeName || undefined,
          region: p.adminName1 || undefined,
          country: p.countryCode,
          countryCode: p.countryCode,
          label: [p.postalCode, p.placeName, p.adminName1, p.countryCode].filter(Boolean).join(', '),
        }));
        return reply.send({ results });
      }

      if (mode === 'country') {
        const res = await fetch(
          `${GEONAMES_BASE}/searchJSON?q=${encodeURIComponent(query)}&maxRows=8&featureCode=PCLI&style=medium&username=${geonamesUsername}`,
        );
        if (!res.ok) throw new Error(`GeoNames responded ${res.status}`);
        const data = (await res.json()) as { geonames?: GeoNameResult[] };
        const results = (data.geonames ?? []).map((g) => ({
          country: g.countryName || g.name,
          countryCode: g.countryCode,
          label: g.countryName || g.name,
        }));
        return reply.send({ results });
      }

      return reply.send({ results: [] });
    } catch {
      return reply.status(502).send({ results: [], error: 'geonames_unavailable' });
    }
  });
}
