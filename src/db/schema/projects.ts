import { pgTable, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { profiles } from './profiles.js';

export const projects = pgTable(
  'projects',
  {
    did: text('did')
      .notNull()
      .references(() => profiles.did, { onDelete: 'cascade' }),
    rkey: text('rkey').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    url: text('url'),
    startedAt: text('started_at'),
    endedAt: text('ended_at'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    indexedAt: timestamp('indexed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.did, table.rkey] })],
);
