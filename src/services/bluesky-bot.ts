import { AtpAgent } from '@atproto/api';
import type { FastifyBaseLogger } from 'fastify';

export async function createBotAgent(
  identifier: string | undefined,
  appPassword: string | undefined,
  log: FastifyBaseLogger,
): Promise<AtpAgent | null> {
  if (!identifier || !appPassword) {
    log.warn('SIFA_BOT_IDENTIFIER or SIFA_BOT_APP_PASSWORD not set — Bluesky posting disabled');
    return null;
  }

  const agent = new AtpAgent({ service: 'https://bsky.social' });
  try {
    await agent.login({ identifier, password: appPassword });
    log.info({ identifier }, 'Bluesky bot agent authenticated');
    return agent;
  } catch (err) {
    log.error({ err, identifier }, 'Failed to authenticate Bluesky bot agent');
    return null;
  }
}
