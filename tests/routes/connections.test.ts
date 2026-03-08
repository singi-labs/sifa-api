import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDb } from '../../src/db/index.js';
import { connections } from '../../src/db/schema/index.js';
import { sql } from 'drizzle-orm';
import { getMutualFollowCount, checkViewerRelationship } from '../../src/routes/profile.js';

describe('Mutual follow detection', () => {
  const db = createDb(process.env.DATABASE_URL ?? 'postgresql://sifa:sifa@localhost:5432/sifa');

  beforeAll(async () => {
    // Create mutual follows
    await db.insert(connections).values([
      { followerDid: 'did:plc:alice', subjectDid: 'did:plc:bob', source: 'sifa', createdAt: new Date() },
      { followerDid: 'did:plc:bob', subjectDid: 'did:plc:alice', source: 'sifa', createdAt: new Date() },
      // One-way follow
      { followerDid: 'did:plc:alice', subjectDid: 'did:plc:carol', source: 'sifa', createdAt: new Date() },
    ]).onConflictDoNothing();
  });

  afterAll(async () => {
    await db.execute(sql`DELETE FROM connections WHERE follower_did IN ('did:plc:alice', 'did:plc:bob', 'did:plc:carol')`);
    await db.$client.end();
  });

  it('counts mutual follows as connections', async () => {
    const result = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM connections a
      JOIN connections b ON a.subject_did = b.follower_did AND a.follower_did = b.subject_did
      WHERE a.follower_did = 'did:plc:alice' AND a.source = 'sifa' AND b.source = 'sifa'
    `);
    expect((result.rows[0] as { count: number })?.count).toBe(1); // Only Bob is mutual
  });

  it('getMutualFollowCount returns correct count', async () => {
    const count = await getMutualFollowCount(db, 'did:plc:alice');
    expect(count).toBe(1); // Only Bob is mutual
  });

  it('getMutualFollowCount returns 0 for user with no mutual follows', async () => {
    const count = await getMutualFollowCount(db, 'did:plc:carol');
    expect(count).toBe(0);
  });

  it('checkViewerRelationship detects following', async () => {
    const rel = await checkViewerRelationship(db, 'did:plc:alice', 'did:plc:carol');
    expect(rel.isFollowing).toBe(true);
    expect(rel.isConnection).toBe(false); // Carol doesn't follow Alice back
  });

  it('checkViewerRelationship detects mutual connection', async () => {
    const rel = await checkViewerRelationship(db, 'did:plc:alice', 'did:plc:bob');
    expect(rel.isFollowing).toBe(true);
    expect(rel.isConnection).toBe(true);
  });

  it('checkViewerRelationship returns false for no relationship', async () => {
    const rel = await checkViewerRelationship(db, 'did:plc:carol', 'did:plc:bob');
    expect(rel.isFollowing).toBe(false);
    expect(rel.isConnection).toBe(false);
  });
});
