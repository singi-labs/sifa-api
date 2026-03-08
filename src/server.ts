import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import type { Env } from './config.js';
import { createDb } from './db/index.js';
import { registerOAuthMetadata } from './oauth/metadata.js';
import { registerOAuthRoutes } from './oauth/routes.js';
import { registerProfileRoutes } from './routes/profile.js';

export async function buildServer(config: Env) {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'test' ? 'silent' : 'info',
    },
  });

  const db = createDb(config.DATABASE_URL);

  await app.register(helmet);
  await app.register(cors, { origin: config.PUBLIC_URL, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, { max: 60, timeWindow: '1 minute' });

  app.get('/api/health', async () => ({ status: 'ok' }));

  registerOAuthMetadata(app, config);
  registerOAuthRoutes(app, null);
  registerProfileRoutes(app, db);

  return app;
}
