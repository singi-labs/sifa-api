import type { Agent } from '@atproto/api';
import type { Database } from '../db/index.js';
import { connections } from '../db/schema/index.js';

/**
 * Fetches Bluesky follows from the user's PDS using listRecords
 * (AT Protocol-native, works with any PDS — no Bluesky AppView dependency).
 */
export async function fetchBlueskyFollowsFromPds(
  agent: Agent,
  did: string,
): Promise<Array<{ did: string; createdAt: string }>> {
  const follows: Array<{ did: string; createdAt: string }> = [];
  let cursor: string | undefined;
  do {
    const res = await agent.com.atproto.repo.listRecords({
      repo: did,
      collection: 'app.bsky.graph.follow',
      limit: 100,
      cursor,
    });
    for (const record of res.data.records) {
      const val = record.value as { subject?: string; createdAt?: string };
      if (val.subject) {
        follows.push({
          did: val.subject,
          createdAt: val.createdAt ?? new Date().toISOString(),
        });
      }
    }
    cursor = res.data.cursor;
  } while (cursor);
  return follows;
}

export async function importBlueskyFollows(
  db: Database,
  followerDid: string,
  follows: Array<{ did: string; createdAt: string }>,
) {
  const rows = follows.map((f) => ({
    followerDid,
    subjectDid: f.did,
    source: 'bluesky' as const,
    createdAt: new Date(f.createdAt),
  }));
  if (rows.length === 0) return;

  await db.insert(connections).values(rows).onConflictDoNothing();
}
