import Fastify, { type FastifyError } from 'fastify';
import * as Sentry from '@sentry/node';
import './middleware/types.js';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createLocalStorage } from './lib/storage.js';
import type { Env } from './config.js';
import { createDb } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { createValkey } from './cache/index.js';
import { createOAuthClient } from './oauth/client.js';
import { registerOAuthMetadata } from './oauth/metadata.js';
import { registerOAuthRoutes } from './oauth/routes.js';
import { registerProfileRoutes } from './routes/profile.js';
import { registerProfileWriteRoutes } from './routes/profile-write.js';
import { registerImportRoutes } from './routes/import.js';
import { registerFollowRoutes } from './routes/follow.js';
import { registerSearchRoutes } from './routes/search.js';
import { registerSkillsRoutes } from './routes/skills.js';
import { registerExternalAccountRoutes } from './routes/external-accounts.js';
import { registerSuggestionRoutes } from './routes/suggestions.js';
import { registerStatsRoutes } from './routes/stats.js';
import { registerAdminStatsRoutes } from './routes/admin-stats.js';
import { registerLocationRoutes } from './routes/location.js';
import { registerWellKnownRoutes } from './routes/well-known.js';
import { createJetstreamClient } from './jetstream/client.js';
import { createEventRouter } from './jetstream/handler.js';
import { createProfileIndexer } from './jetstream/indexers/profile.js';
import { createPositionIndexer } from './jetstream/indexers/position.js';
import { createEducationIndexer } from './jetstream/indexers/education.js';
import { createSkillIndexer } from './jetstream/indexers/skill.js';
import { createFollowIndexer } from './jetstream/indexers/follow.js';
import { createExternalAccountIndexer } from './jetstream/indexers/external-account.js';
import { createCertificationIndexer } from './jetstream/indexers/certification.js';
import { createProjectIndexer } from './jetstream/indexers/project.js';
import { createVolunteeringIndexer } from './jetstream/indexers/volunteering.js';
import { createPublicationIndexer } from './jetstream/indexers/publication.js';
import { createCourseIndexer } from './jetstream/indexers/course.js';
import { createHonorIndexer } from './jetstream/indexers/honor.js';
import { createLanguageIndexer } from './jetstream/indexers/language.js';
import { createCursorManager } from './jetstream/cursor.js';
import { registerActivityRoutes } from './routes/activity.js';
import { registerAppsRoutes } from './routes/apps.js';
import { registerFeaturedRoutes } from './routes/featured.js';
import { startFeaturedProfileJob } from './services/featured-job.js';
import { createBotAgent } from './services/bluesky-bot.js';

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

  // Run pending migrations on startup
  if (config.NODE_ENV !== 'test') {
    await runMigrations(db);
    app.log.info('Database migrations complete');
  }

  const valkey = config.NODE_ENV !== 'test' ? createValkey(config.VALKEY_URL) : null;
  if (valkey) await valkey.connect();

  if (config.GLITCHTIP_DSN) {
    const dsnUrl = new URL(config.GLITCHTIP_DSN);
    const key = dsnUrl.username;
    const projectId = dsnUrl.pathname.replace('/', '');
    const reportUri = `${dsnUrl.protocol}//${dsnUrl.host}/api/${projectId}/security/?glitchtip_key=${key}`;
    await app.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'report-uri': [reportUri],
        },
      },
    });
  } else {
    await app.register(helmet);
  }
  await app.register(cors, { origin: config.PUBLIC_URL, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, {
    max: 60,
    timeWindow: '1 minute',
    allowList: (req) => {
      // Exempt Docker-internal traffic (service-to-service calls from sifa-web)
      const ip = req.ip;
      return ip === '127.0.0.1' || ip === '::1' || ip.startsWith('172.') || ip.startsWith('10.');
    },
  });

  await app.register(fastifyMultipart, {
    limits: { fileSize: config.UPLOAD_MAX_SIZE_BYTES ?? 5_242_880 },
  });

  const uploadDir = resolve(config.UPLOAD_DIR ?? './uploads');
  await app.register(fastifyStatic, {
    root: uploadDir,
    prefix: '/uploads/',
    decorateReply: false,
  });

  const storage = createLocalStorage(uploadDir, config.PUBLIC_URL, app.log);

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

  // Create OAuth client (required in non-test mode)
  let oauthClient = null;
  if (config.NODE_ENV !== 'test') {
    if (!valkey) {
      throw new Error('Valkey connection required for OAuth — check VALKEY_URL');
    }
    if (!existsSync(config.OAUTH_JWKS_PATH)) {
      const privateKeyPath = config.OAUTH_JWKS_PATH.replace('jwks', 'private-key');
      throw new Error(
        `OAuth keys missing — expected ${config.OAUTH_JWKS_PATH} and ${privateKeyPath}. ` +
          'Generate with: node -e "..." (see sifa-deploy README)',
      );
    }
    oauthClient = await createOAuthClient(config, db, valkey);
  }

  registerWellKnownRoutes(app, db, valkey, config.SIFA_DID);
  registerOAuthMetadata(app, config);
  registerOAuthRoutes(app, db, oauthClient);
  registerProfileRoutes(app, db, valkey);
  registerProfileWriteRoutes(app, db, oauthClient, storage);
  registerImportRoutes(app, db, oauthClient);
  registerFollowRoutes(app, db, oauthClient);
  registerSearchRoutes(app, db);
  registerSkillsRoutes(app, db);
  registerExternalAccountRoutes(app, db, oauthClient, valkey);
  registerSuggestionRoutes(app, db, oauthClient, config.PUBLIC_URL);
  registerStatsRoutes(app, db, valkey);
  registerAdminStatsRoutes(app, db, valkey, oauthClient, config);
  registerLocationRoutes(app, config.GEONAMES_USERNAME);
  registerActivityRoutes(app, db, oauthClient);
  registerAppsRoutes(app, valkey);
  registerFeaturedRoutes(app, db, valkey);

  // Start Jetstream in non-test mode
  if (config.NODE_ENV !== 'test') {
    const cursorManager = createCursorManager(db);

    const eventRouter = createEventRouter(db, {
      profileIndexer: createProfileIndexer(db),
      positionIndexer: createPositionIndexer(db),
      educationIndexer: createEducationIndexer(db),
      skillIndexer: createSkillIndexer(db),
      certificationIndexer: createCertificationIndexer(db),
      projectIndexer: createProjectIndexer(db),
      volunteeringIndexer: createVolunteeringIndexer(db),
      publicationIndexer: createPublicationIndexer(db),
      courseIndexer: createCourseIndexer(db),
      honorIndexer: createHonorIndexer(db),
      languageIndexer: createLanguageIndexer(db),
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

    const botAgent = await createBotAgent(
      config.SIFA_BOT_IDENTIFIER ?? 'sifa.id',
      config.SIFA_BOT_APP_PASSWORD,
      app.log,
    );

    const featuredTimers = startFeaturedProfileJob(
      db,
      valkey,
      botAgent,
      config.PUBLIC_URL,
      app.log,
    );
    app.addHook('onClose', () => {
      clearTimeout(featuredTimers.selectionTimer);
      clearTimeout(featuredTimers.postTimer);
    });
  }

  return app;
}
