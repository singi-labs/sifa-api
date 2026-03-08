import { describe, it, expect, afterAll } from 'vitest';
import { createDb } from '../../src/db/index.js';

describe('Database connection', () => {
  const db = createDb(process.env.DATABASE_URL ?? 'postgresql://sifa:sifa@localhost:5432/sifa');

  afterAll(async () => {
    await db.$client.end();
  });

  it('connects and runs a query', async () => {
    const result = await db.execute('SELECT 1 as num');
    expect(result.rows[0]).toEqual({ num: 1 });
  });
});
