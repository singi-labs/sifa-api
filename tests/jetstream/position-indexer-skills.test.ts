import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDb } from '../../src/db/index.js';
import { positions, profiles, skills, skillPositionLinks } from '../../src/db/schema/index.js';
import { createPositionIndexer } from '../../src/jetstream/indexers/position.js';
import { eq, and, sql } from 'drizzle-orm';

describe('Position indexer skill-position links', () => {
  const db = createDb(process.env.DATABASE_URL ?? 'postgresql://sifa:sifa@localhost:5432/sifa');
  const testDid = 'did:plc:pos-skill-link-test';

  beforeAll(async () => {
    await db
      .insert(profiles)
      .values({
        did: testDid,
        handle: 'pos-skill-test.bsky.social',
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(skills)
      .values({
        did: testDid,
        rkey: '3skill1',
        skillName: 'TypeScript',
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(skills)
      .values({
        did: testDid,
        rkey: '3skill2',
        skillName: 'PostgreSQL',
        createdAt: new Date(),
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await db.execute(sql`DELETE FROM skill_position_links WHERE did = ${testDid}`);
    await db.delete(positions).where(eq(positions.did, testDid));
    await db.delete(skills).where(eq(skills.did, testDid));
    await db.execute(sql`DELETE FROM profiles WHERE did = ${testDid}`);
    await db.$client.end();
  });

  it('creates skill-position links from position skills array', async () => {
    const indexer = createPositionIndexer(db);
    await indexer({
      did: testDid,
      time_us: 1234567890,
      kind: 'commit',
      commit: {
        rev: 'rev1',
        operation: 'create',
        collection: 'id.sifa.profile.position',
        rkey: '3pos1',
        record: {
          companyName: 'Acme',
          title: 'Engineer',
          startDate: '2024-01',
          current: true,
          createdAt: '2026-01-01T00:00:00Z',
          skills: [
            { uri: `at://${testDid}/id.sifa.profile.skill/3skill1`, cid: 'bafyabc1' },
            { uri: `at://${testDid}/id.sifa.profile.skill/3skill2`, cid: 'bafyabc2' },
          ],
        },
      },
    });

    const links = await db
      .select()
      .from(skillPositionLinks)
      .where(
        and(eq(skillPositionLinks.did, testDid), eq(skillPositionLinks.positionRkey, '3pos1')),
      );
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.skillRkey).sort()).toEqual(['3skill1', '3skill2']);
  });

  it('replaces links on position update', async () => {
    const indexer = createPositionIndexer(db);
    await indexer({
      did: testDid,
      time_us: 1234567891,
      kind: 'commit',
      commit: {
        rev: 'rev2',
        operation: 'update',
        collection: 'id.sifa.profile.position',
        rkey: '3pos1',
        record: {
          companyName: 'Acme',
          title: 'Senior Engineer',
          startDate: '2024-01',
          current: true,
          createdAt: '2026-01-01T00:00:00Z',
          skills: [{ uri: `at://${testDid}/id.sifa.profile.skill/3skill1`, cid: 'bafyabc1' }],
        },
      },
    });

    const links = await db
      .select()
      .from(skillPositionLinks)
      .where(
        and(eq(skillPositionLinks.did, testDid), eq(skillPositionLinks.positionRkey, '3pos1')),
      );
    expect(links).toHaveLength(1);
    expect(links[0].skillRkey).toBe('3skill1');
  });

  it('removes all links on position delete', async () => {
    const indexer = createPositionIndexer(db);
    await indexer({
      did: testDid,
      time_us: 1234567892,
      kind: 'commit',
      commit: {
        rev: 'rev3',
        operation: 'delete',
        collection: 'id.sifa.profile.position',
        rkey: '3pos1',
      },
    });

    const links = await db
      .select()
      .from(skillPositionLinks)
      .where(
        and(eq(skillPositionLinks.did, testDid), eq(skillPositionLinks.positionRkey, '3pos1')),
      );
    expect(links).toHaveLength(0);
  });

  it('handles position with no skills array gracefully', async () => {
    const indexer = createPositionIndexer(db);
    await indexer({
      did: testDid,
      time_us: 1234567893,
      kind: 'commit',
      commit: {
        rev: 'rev4',
        operation: 'create',
        collection: 'id.sifa.profile.position',
        rkey: '3pos2',
        record: {
          companyName: 'Other Corp',
          title: 'Dev',
          startDate: '2025-01',
          current: false,
          createdAt: '2026-01-01T00:00:00Z',
        },
      },
    });

    const links = await db
      .select()
      .from(skillPositionLinks)
      .where(
        and(eq(skillPositionLinks.did, testDid), eq(skillPositionLinks.positionRkey, '3pos2')),
      );
    expect(links).toHaveLength(0);
  });
});
