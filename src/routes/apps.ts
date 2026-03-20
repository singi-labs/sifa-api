import type { FastifyInstance } from 'fastify';
import type { ValkeyClient } from '../cache/index.js';
import { getAppsRegistry } from '../lib/atproto-app-registry.js';

const APPS_REGISTRY_KEY = 'apps:registry';
const APPS_REGISTRY_TTL = 86400; // 24 hours

export function registerAppsRoutes(app: FastifyInstance, valkey: ValkeyClient | null) {
  app.get('/api/apps/registry', async (_request, reply) => {
    if (valkey) {
      const cached = await valkey.get(APPS_REGISTRY_KEY);
      if (cached !== null) {
        return reply.send(JSON.parse(cached));
      }
    }

    const registry = getAppsRegistry();

    if (valkey) {
      await valkey.setex(APPS_REGISTRY_KEY, APPS_REGISTRY_TTL, JSON.stringify(registry));
    }

    return reply.send(registry);
  });
}
