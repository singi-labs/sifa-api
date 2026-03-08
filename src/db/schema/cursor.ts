import { pgTable, text, bigint, timestamp } from 'drizzle-orm/pg-core';

export const jetstreamCursor = pgTable('jetstream_cursor', {
  id: text('id').primaryKey().default('main'),
  cursor: bigint('cursor', { mode: 'bigint' }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
