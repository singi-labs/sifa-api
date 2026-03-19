import { describe, it, expect, vi } from 'vitest';
import { createBotAgent } from '../../src/services/bluesky-bot.js';

describe('createBotAgent', () => {
  const mockLog = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as import('fastify').FastifyBaseLogger;

  it('returns null when identifier is missing', async () => {
    const agent = await createBotAgent(undefined, 'password', mockLog);
    expect(agent).toBeNull();
    expect(mockLog.warn).toHaveBeenCalled();
  });

  it('returns null when app password is missing', async () => {
    const agent = await createBotAgent('sifa.id', undefined, mockLog);
    expect(agent).toBeNull();
  });

  it('returns null when both are missing', async () => {
    const agent = await createBotAgent(undefined, undefined, mockLog);
    expect(agent).toBeNull();
  });
});
