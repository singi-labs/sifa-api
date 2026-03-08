import { describe, it, expect, afterAll } from 'vitest';
import { createDb } from '../../src/db/index.js';
import { createCursorManager } from '../../src/jetstream/cursor.js';
import { sql } from 'drizzle-orm';

describe('Cursor manager', () => {
  const db = createDb(process.env.DATABASE_URL ?? 'postgresql://sifa:sifa@localhost:5432/sifa');

  afterAll(async () => {
    // Clean up test data
    await db.execute(sql`DELETE FROM jetstream_cursor WHERE id = 'test'`);
    await db.$client.end();
  });

  it('returns undefined when no cursor exists', async () => {
    const cm = createCursorManager(db, 'test');
    // Delete any existing test cursor
    await db.execute(sql`DELETE FROM jetstream_cursor WHERE id = 'test'`);
    const cursor = await cm.get();
    expect(cursor).toBeUndefined();
  });

  it('saves and retrieves cursor', async () => {
    const cm = createCursorManager(db, 'test');
    await cm.save(9999999n);
    const cursor = await cm.get();
    expect(cursor).toBe(9999999n);
  });
});
