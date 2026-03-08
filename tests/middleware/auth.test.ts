import { describe, it, expect } from 'vitest';
import { createAuthMiddleware } from '../../src/middleware/auth.js';

describe('Auth middleware', () => {
  it('returns 401 when no session cookie', async () => {
    const middleware = createAuthMiddleware({} as any);
    const request = { cookies: {} } as any;
    const reply = {
      status: (code: number) => ({ send: (body: any) => ({ statusCode: code, body }) }),
    } as any;

    const result = await middleware(request, reply);
    expect(result.statusCode).toBe(401);
  });
});
