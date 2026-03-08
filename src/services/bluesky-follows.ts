import type { Database } from '../db/index.js';
import { connections } from '../db/schema/index.js';

export function mapBskyFollowToConnection(followerDid: string, follow: { did: string; handle: string; createdAt: string }) {
  return {
    followerDid,
    subjectDid: follow.did,
    source: 'bluesky' as const,
    createdAt: new Date(follow.createdAt),
  };
}

export async function importBlueskyFollows(db: Database, followerDid: string, follows: Array<{ did: string; handle: string; createdAt: string }>) {
  const rows = follows.map(f => mapBskyFollowToConnection(followerDid, f));
  if (rows.length === 0) return;

  await db.insert(connections).values(rows).onConflictDoNothing();
}
