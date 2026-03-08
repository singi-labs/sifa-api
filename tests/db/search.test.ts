import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDb } from '../../src/db/index.js';
import { profiles } from '../../src/db/schema/index.js';
import { sql } from 'drizzle-orm';

describe('Full-text search', () => {
  const db = createDb(process.env.DATABASE_URL ?? 'postgresql://sifa:sifa@localhost:5432/sifa');

  beforeAll(async () => {
    // Insert test profile
    await db
      .insert(profiles)
      .values({
        did: 'did:plc:test-search',
        handle: 'alice.bsky.social',
        headline: 'Senior TypeScript Engineer',
        about: 'Building distributed systems',
        createdAt: new Date(),
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await db.delete(profiles).where(sql`did = 'did:plc:test-search'`);
    await db.$client.end();
  });

  it('finds profile by headline keyword', async () => {
    const result = await db.execute(sql`
      SELECT did, handle, headline FROM profiles
      WHERE to_tsvector('english', coalesce(headline, '') || ' ' || coalesce(about, ''))
        @@ plainto_tsquery('english', 'TypeScript')
    `);
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
    expect(result.rows[0]?.did).toBe('did:plc:test-search');
  });
});
