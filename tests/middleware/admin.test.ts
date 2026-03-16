import { describe, it, expect, vi } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Env } from '../../src/config.js';
import { createAdminMiddleware } from '../../src/middleware/admin.js';

function makeConfig(adminDids?: string): Env {
  return {
    NODE_ENV: 'test',
    PORT: 3100,
    PUBLIC_URL: 'http://localhost:3100',
    DATABASE_URL: 'postgresql://localhost/test',
    VALKEY_URL: 'redis://localhost:6379',
    SIFA_DID: 'did:plc:test',
    JETSTREAM_URL: 'wss://jetstream.example.com',
    OAUTH_JWKS_PATH: '/tmp/jwks',
    GEONAMES_USERNAME: 'test',
    ADMIN_DIDS: adminDids,
  };
}

function makeMocks(did: string | null) {
  const request = { did } as FastifyRequest;
  const send = vi.fn();
  const status = vi.fn().mockReturnValue({ send });
  const reply = { status, send } as unknown as FastifyReply;
  return { request, reply, status, send };
}

describe('Admin middleware', () => {
  it('allows a DID that is in the admin list', async () => {
    const middleware = createAdminMiddleware(makeConfig('did:plc:admin1,did:plc:admin2'));
    const { request, reply, status } = makeMocks('did:plc:admin1');

    await middleware(request, reply);

    expect(status).not.toHaveBeenCalled();
  });

  it('rejects a DID that is not in the admin list', async () => {
    const middleware = createAdminMiddleware(makeConfig('did:plc:admin1'));
    const { request, reply, status, send } = makeMocks('did:plc:other');

    await middleware(request, reply);

    expect(status).toHaveBeenCalledWith(403);
    expect(send).toHaveBeenCalledWith({ error: 'Forbidden', message: 'Admin access required' });
  });

  it('rejects when ADMIN_DIDS is unset (fails closed)', async () => {
    const middleware = createAdminMiddleware(makeConfig(undefined));
    const { request, reply, status, send } = makeMocks('did:plc:anyone');

    await middleware(request, reply);

    expect(status).toHaveBeenCalledWith(403);
    expect(send).toHaveBeenCalledWith({ error: 'Forbidden', message: 'Admin access required' });
  });

  it('rejects when ADMIN_DIDS is empty string (fails closed)', async () => {
    const middleware = createAdminMiddleware(makeConfig(''));
    const { request, reply, status, send } = makeMocks('did:plc:anyone');

    await middleware(request, reply);

    expect(status).toHaveBeenCalledWith(403);
    expect(send).toHaveBeenCalledWith({ error: 'Forbidden', message: 'Admin access required' });
  });

  it('rejects when request.did is null', async () => {
    const middleware = createAdminMiddleware(makeConfig('did:plc:admin1'));
    const { request, reply, status, send } = makeMocks(null);

    await middleware(request, reply);

    expect(status).toHaveBeenCalledWith(403);
    expect(send).toHaveBeenCalledWith({ error: 'Forbidden', message: 'Admin access required' });
  });

  it('trims whitespace around DIDs in the list', async () => {
    const middleware = createAdminMiddleware(makeConfig('  did:plc:admin1 , did:plc:admin2  '));
    const { request, reply, status } = makeMocks('did:plc:admin2');

    await middleware(request, reply);

    expect(status).not.toHaveBeenCalled();
  });
});
