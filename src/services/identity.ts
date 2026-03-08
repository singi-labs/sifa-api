import { isValidHandle, isValidDid } from '@atproto/syntax';
import { Agent } from '@atproto/api';

export const isHandle = isValidHandle;
export const isDid = isValidDid;

export async function resolveHandleOrDid(
  handleOrDid: string,
): Promise<{ did: string; handle: string }> {
  const agent = new Agent('https://public.api.bsky.app');

  if (isDid(handleOrDid)) {
    const profile = await agent.getProfile({ actor: handleOrDid });
    return { did: profile.data.did, handle: profile.data.handle };
  }

  if (isHandle(handleOrDid)) {
    const resolved = await agent.resolveHandle({ handle: handleOrDid });
    return { did: resolved.data.did, handle: handleOrDid };
  }

  throw new Error(`Invalid handle or DID: ${handleOrDid}`);
}
