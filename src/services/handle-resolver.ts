import { isValidHandle } from '@atproto/syntax';
import { Agent } from '@atproto/api';
import { logger } from '../logger.js';

export interface ResolvedProfile {
  did: string;
  handle: string;
  displayName: string | undefined;
  avatar: string | undefined;
  about: string | undefined;
}

const SIMPLE_HANDLE_RE = /^[a-zA-Z0-9-]+$/;
const publicAgent = new Agent('https://public.api.bsky.app');

export async function resolveHandleFromNetwork(
  query: string,
): Promise<ResolvedProfile | null> {
  const candidates: string[] = [];

  if (isValidHandle(query)) {
    candidates.push(query);
  }

  // If no dots and looks like a simple username, also try .bsky.social
  if (SIMPLE_HANDLE_RE.test(query) && !query.includes('.')) {
    const bskySocial = `${query}.bsky.social`;
    if (isValidHandle(bskySocial) && !candidates.includes(bskySocial)) {
      candidates.push(bskySocial);
    }
  }

  for (const handle of candidates) {
    try {
      const response = await publicAgent.getProfile(
        { actor: handle },
        { signal: AbortSignal.timeout(3000) },
      );
      return {
        did: response.data.did,
        handle: response.data.handle,
        displayName: response.data.displayName || undefined,
        avatar: response.data.avatar || undefined,
        about: response.data.description || undefined,
      };
    } catch (err) {
      logger.debug({ handle, err }, 'Handle resolution failed');
    }
  }

  return null;
}
