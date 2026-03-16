import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Env } from '../config.js';
import './types.js';

/**
 * Creates an admin middleware that checks `request.did` against the
 * comma-separated allowlist in `config.ADMIN_DIDS`.
 *
 * Runs after auth middleware (which sets `request.did`).
 * Fails closed: if ADMIN_DIDS is unset or empty, all requests are denied.
 */
export function createAdminMiddleware(config: Env) {
  const adminDids = new Set(
    (config.ADMIN_DIDS ?? '')
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean),
  );

  return async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
    if (!request.did || !adminDids.has(request.did)) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Admin access required' });
    }
  };
}
