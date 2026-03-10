import Fastify, { type FastifyError } from 'fastify';
import * as Sentry from '@sentry/node';
import './middleware/types.js';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { existsSync } from 'node:fs';
import type { Env } from './config.js';
import { createDb } from './db/index.js';
import { createValkey } from './cache/index.js';
import { createOAuthClient } from './oauth/client.js';
import { registerOAuthMetadata } from './oauth/metadata.js';
import { registerOAuthRoutes } from './oauth/routes.js';
import { registerProfileRoutes } from './routes/profile.js';
import { registerProfileWriteRoutes } from './routes/profile-write.js';
import { registerImportRoutes } from './routes/import.js';
import { registerFollowRoutes } from './routes/follow.js';
import { registerSearchRoutes } from './routes/search.js';
import { registerExternalAccountRoutes } from './routes/external-accounts.js';
import { registerWellKnownRoutes } from './routes/well-known.js';
import { createJetstreamClient } from './jetstream/client.js';
import { createEventRouter } from './jetstream/handler.js';
import { createProfileIndexer } from './jetstream/indexers/profile.js';
import { createPositionIndexer } from './jetstream/indexers/position.js';
import { createEducationIndexer } from './jetstream/indexers/education.js';
import { createSkillIndexer } from './jetstream/indexers/skill.js';
import { createFollowIndexer } from './jetstream/indexers/follow.js';
import { createExternalAccountIndexer } from './jetstream/indexers/external-account.js';
import { createCursorManager } from './jetstream/cursor.js';

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

  app.decorateRequest('did', null);
  app.decorateRequest('oauthSession', null);

  const db = createDb(config.DATABASE_URL);
  const valkey = config.NODE_ENV !== 'test' ? createValkey(config.VALKEY_URL) : null;
  if (valkey) await valkey.connect();

  await app.register(helmet);
  await app.register(cors, { origin: config.PUBLIC_URL, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, { max: 60, timeWindow: '1 minute' });

  app.setErrorHandler(async (error: FastifyError, _request, reply) => {
    if (config.GLITCHTIP_DSN) {
      Sentry.captureException(error);
    }
    app.log.error(error);
    return reply.status(error.statusCode ?? 500).send({
      error: error.message,
    });
  });

  app.get('/api/health', async () => ({ status: 'ok' }));

  // Create OAuth client conditionally (skip in test mode or when JWKS file doesn't exist)
  let oauthClient = null;
  if (config.NODE_ENV !== 'test' && valkey && existsSync(config.OAUTH_JWKS_PATH)) {
    oauthClient = await createOAuthClient(config, db, valkey);
  }

  registerWellKnownRoutes(app, db, valkey, config.SIFA_DID);
  registerOAuthMetadata(app, config);
  registerOAuthRoutes(app, db, oauthClient);
  registerProfileRoutes(app, db);
  registerProfileWriteRoutes(app, db, oauthClient);
  registerImportRoutes(app, db, oauthClient);
  registerFollowRoutes(app, db, oauthClient);
  registerSearchRoutes(app, db);
  registerExternalAccountRoutes(app, db, oauthClient, valkey);

  // Start Jetstream in non-test mode
  if (config.NODE_ENV !== 'test') {
    const cursorManager = createCursorManager(db);

    const eventRouter = createEventRouter(db, {
      profileIndexer: createProfileIndexer(db),
      positionIndexer: createPositionIndexer(db),
      educationIndexer: createEducationIndexer(db),
      skillIndexer: createSkillIndexer(db),
      followIndexer: createFollowIndexer(db),
      externalAccountIndexer: createExternalAccountIndexer(db),
    });

    const jetstream = createJetstreamClient({
      url: config.JETSTREAM_URL,
      onEvent: async (event) => {
        await eventRouter(event);
        if (event.time_us) await cursorManager.save(BigInt(event.time_us));
      },
      getCursor: () => cursorManager.get(),
    });

    await jetstream.connect();
    app.addHook('onClose', () => jetstream.disconnect());
  }

  return app;
}
