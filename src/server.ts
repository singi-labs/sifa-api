import Fastify from 'fastify';
import * as Sentry from '@sentry/node';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import type { Env } from './config.js';
import { createDb } from './db/index.js';
import { createValkey } from './cache/index.js';
import { registerOAuthMetadata } from './oauth/metadata.js';
import { registerOAuthRoutes } from './oauth/routes.js';
import { registerProfileRoutes } from './routes/profile.js';
import { registerProfileWriteRoutes } from './routes/profile-write.js';
import { registerImportRoutes } from './routes/import.js';
import { registerFollowRoutes } from './routes/follow.js';
import { registerSearchRoutes } from './routes/search.js';
import { registerWellKnownRoutes } from './routes/well-known.js';

export async function buildServer(config: Env) {
  if (config.GLITCHTIP_DSN) {
    Sentry.init({
      dsn: config.GLITCHTIP_DSN,
      environment: config.NODE_ENV,
    });
  }

  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'test' ? 'silent' : 'info',
    },
  });

  const db = createDb(config.DATABASE_URL);
  const valkey = config.NODE_ENV !== 'test' ? createValkey(config.VALKEY_URL) : null;

  await app.register(helmet);
  await app.register(cors, { origin: config.PUBLIC_URL, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, { max: 60, timeWindow: '1 minute' });

  app.setErrorHandler(async (error, _request, reply) => {
    if (config.GLITCHTIP_DSN) {
      Sentry.captureException(error);
    }
    app.log.error(error);
    return reply.status(error.statusCode ?? 500).send({
      error: error.message,
    });
  });

  app.get('/api/health', async () => ({ status: 'ok' }));

  registerWellKnownRoutes(app, db, valkey, config.SIFA_DID);
  registerOAuthMetadata(app, config);
  registerOAuthRoutes(app, null);
  registerProfileRoutes(app, db);
  registerProfileWriteRoutes(app, db, null);
  registerImportRoutes(app, null);
  registerFollowRoutes(app, db, null);
  registerSearchRoutes(app, db);

  return app;
}
