import { AtpAgent } from '@atproto/api';
import type { FastifyBaseLogger } from 'fastify';

async function resolvePdsEndpoint(identifier: string): Promise<string> {
  // If identifier is a DID, resolve via PLC directory
  if (identifier.startsWith('did:plc:')) {
    const res = await fetch(`https://plc.directory/${identifier}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const doc = (await res.json()) as {
        service?: Array<{ id: string; serviceEndpoint: string }>;
      };
      const pds = doc.service?.find((s) => s.id === '#atproto_pds');
      if (pds?.serviceEndpoint) return pds.serviceEndpoint;
    }
  }

  // If identifier is a handle, resolve DID first then PDS
  if (!identifier.startsWith('did:')) {
    const handleRes = await fetch(
      `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(identifier)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (handleRes.ok) {
      const { did } = (await handleRes.json()) as { did: string };
      return resolvePdsEndpoint(did);
    }
  }

  // Fallback to bsky.social
  return 'https://bsky.social';
}

export async function createBotAgent(
  identifier: string | undefined,
  appPassword: string | undefined,
  log: FastifyBaseLogger,
): Promise<AtpAgent | null> {
  if (!identifier || !appPassword) {
    log.warn('SIFA_BOT_IDENTIFIER or SIFA_BOT_APP_PASSWORD not set — Bluesky posting disabled');
    return null;
  }

  let pdsUrl: string;
  try {
    pdsUrl = await resolvePdsEndpoint(identifier);
    log.info({ identifier, pdsUrl }, 'Resolved PDS endpoint for bot agent');
  } catch (err) {
    log.warn({ err, identifier }, 'Failed to resolve PDS — falling back to bsky.social');
    pdsUrl = 'https://bsky.social';
  }

  const agent = new AtpAgent({ service: pdsUrl });
  try {
    await agent.login({ identifier, password: appPassword });
    log.info({ identifier, pdsUrl }, 'Bluesky bot agent authenticated');
    return agent;
  } catch (err) {
    log.error({ err, identifier, pdsUrl }, 'Failed to authenticate Bluesky bot agent');
    return null;
  }
}
