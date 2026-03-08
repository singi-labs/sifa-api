import { describe, it, expect } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import type { Database } from '../../src/db/index.js';
import { createAuthMiddleware } from '../../src/middleware/auth.js';

describe('Auth middleware', () => {
  it('returns 401 when no session cookie', async () => {
    const middleware = createAuthMiddleware(
      {} as unknown as NodeOAuthClient,
      {} as unknown as Database,
    );
    const request = { cookies: {} } as unknown as FastifyRequest;
    const reply = {
      status: (code: number) => ({
        send: (body: Record<string, unknown>) => ({ statusCode: code, body }),
      }),
    } as unknown as FastifyReply;

    const result = await middleware(request, reply);
    expect((result as { statusCode: number }).statusCode).toBe(401);
  });

  it('returns 503 when oauthClient is null', async () => {
    const middleware = createAuthMiddleware(null, {} as unknown as Database);
    const request = { cookies: { session: 'some-session-id' } } as unknown as FastifyRequest;
    const reply = {
      status: (code: number) => ({
        send: (body: Record<string, unknown>) => ({ statusCode: code, body }),
      }),
    } as unknown as FastifyReply;

    const result = await middleware(request, reply);
    expect((result as { statusCode: number }).statusCode).toBe(503);
  });
});
