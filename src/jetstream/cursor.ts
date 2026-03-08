import type { Database } from '../db/index.js';
import { jetstreamCursor } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

export function createCursorManager(db: Database, id = 'main') {
  return {
    async get(): Promise<bigint | undefined> {
      const rows = await db
        .select()
        .from(jetstreamCursor)
        .where(eq(jetstreamCursor.id, id))
        .limit(1);
      return rows[0]?.cursor;
    },
    async save(cursor: bigint): Promise<void> {
      await db
        .insert(jetstreamCursor)
        .values({ id, cursor, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: jetstreamCursor.id,
          set: { cursor, updatedAt: new Date() },
        });
    },
  };
}
