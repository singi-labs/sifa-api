import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import type { Env } from './config.js';
import { registerOAuthMetadata } from './oauth/metadata.js';

export async function buildServer(config: Env) {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'test' ? 'silent' : 'info',
    },
  });

  await app.register(helmet);
  await app.register(cors, { origin: config.PUBLIC_URL, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, { max: 60, timeWindow: '1 minute' });

  app.get('/api/health', async () => ({ status: 'ok' }));

  registerOAuthMetadata(app, config);

  return app;
}
