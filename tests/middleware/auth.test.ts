import { describe, it, expect } from 'vitest';
import { createAuthMiddleware } from '../../src/middleware/auth.js';

describe('Auth middleware', () => {
  it('returns 401 when no session cookie', async () => {
    const middleware = createAuthMiddleware({} as any, {} as any);
    const request = { cookies: {} } as any;
    const reply = {
      status: (code: number) => ({ send: (body: any) => ({ statusCode: code, body }) }),
    } as any;

    const result = await middleware(request, reply);
    expect(result.statusCode).toBe(401);
  });

  it('returns 503 when oauthClient is null', async () => {
    const middleware = createAuthMiddleware(null, {} as any);
    const request = { cookies: { session: 'some-session-id' } } as any;
    const reply = {
      status: (code: number) => ({ send: (body: any) => ({ statusCode: code, body }) }),
    } as any;

    const result = await middleware(request, reply);
    expect(result.statusCode).toBe(503);
  });
});
