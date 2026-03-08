import type { FastifyInstance } from 'fastify';
import type { Database } from '../db/index.js';
import type { ValkeyClient } from '../cache/index.js';
import { sql } from 'drizzle-orm';

export function registerWellKnownRoutes(
  app: FastifyInstance,
  db: Database,
  valkey: ValkeyClient | null,
  sifaDid: string,
) {
  app.get('/api/health/ready', async (_req, reply) => {
    const components: Record<string, { status: string; error?: string }> = {};
    let allHealthy = true;

    // Check PostgreSQL
    try {
      await db.execute(sql`SELECT 1`);
      components['postgresql'] = { status: 'ok' };
    } catch (err) {
      allHealthy = false;
      components['postgresql'] = {
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }

    // Check Valkey
    if (valkey) {
      try {
        const pong = await valkey.ping();
        if (pong === 'PONG') {
          components['valkey'] = { status: 'ok' };
        } else {
          allHealthy = false;
          components['valkey'] = { status: 'error', error: `Unexpected response: ${pong}` };
        }
      } catch (err) {
        allHealthy = false;
        components['valkey'] = {
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    } else {
      components['valkey'] = { status: 'skipped' };
    }

    const statusCode = allHealthy ? 200 : 503;
    return reply.status(statusCode).send({
      status: allHealthy ? 'ok' : 'degraded',
      components,
    });
  });

  app.get('/.well-known/atproto-did', async (_req, reply) => {
    return reply.type('text/plain').send(sifaDid);
  });
}
