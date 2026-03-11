import { pgTable, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { profiles } from './profiles.js';

export const volunteering = pgTable(
  'volunteering',
  {
    did: text('did')
      .notNull()
      .references(() => profiles.did, { onDelete: 'cascade' }),
    rkey: text('rkey').notNull(),
    organization: text('organization').notNull(),
    role: text('role'),
    cause: text('cause'),
    description: text('description'),
    startedAt: text('started_at'),
    endedAt: text('ended_at'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    indexedAt: timestamp('indexed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.did, table.rkey] })],
);
