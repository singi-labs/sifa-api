import type { FastifyInstance } from 'fastify';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { userAppStats } from '../db/schema/user-app-stats.js';
import { createAuthMiddleware, getAuthContext } from '../middleware/auth.js';

const visibilitySchema = z.object({
  appId: z.string().min(1).max(200),
  visible: z.boolean(),
});

export function registerActivityRoutes(
  app: FastifyInstance,
  db: Database,
  oauthClient: NodeOAuthClient | null,
) {
  const requireAuth = createAuthMiddleware(oauthClient, db);

  // PUT /api/profile/activity-visibility -- toggle visibility of a specific app's activity
  app.put(
    '/api/profile/activity-visibility',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = visibilitySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'ValidationError', issues: parsed.error.issues });
      }

      const { did } = getAuthContext(request);
      const { appId, visible } = parsed.data;

      const result = await db
        .update(userAppStats)
        .set({ visible })
        .where(and(eq(userAppStats.did, did), eq(userAppStats.appId, appId)));

      if (result.rowCount === 0) {
        return reply.status(404).send({
          error: 'NotFound',
          message: `No activity stats found for app: ${appId}`,
        });
      }

      return reply.status(200).send({ ok: true });
    },
  );
}
