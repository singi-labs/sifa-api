import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import type { Database } from '../db/index.js';
import { emailSubscriptions } from '../db/schema/index.js';
import { createAuthMiddleware, getAuthContext } from '../middleware/auth.js';

const emailSubscriptionSchema = z.object({
  email: z.string().email().max(320),
});

export function registerEmailSubscriptionRoutes(
  app: FastifyInstance,
  db: Database,
  oauthClient: NodeOAuthClient | null,
) {
  const requireAuth = createAuthMiddleware(oauthClient, db);

  // POST /api/email-subscription -- subscribe or update email for welcome notifications
  app.post(
    '/api/email-subscription',
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = emailSubscriptionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'InvalidRequest', issues: parsed.error.issues });
      }

      const { did } = getAuthContext(request);

      await db
        .insert(emailSubscriptions)
        .values({
          did,
          email: parsed.data.email,
          source: 'welcome',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: emailSubscriptions.did,
          set: {
            email: parsed.data.email,
            updatedAt: new Date(),
          },
        });

      return reply.status(201).send({ ok: true });
    },
  );
}
