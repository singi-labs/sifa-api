import { pgTable, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { profiles } from './profiles.js';

export const skillPositionLinks = pgTable(
  'skill_position_links',
  {
    did: text('did')
      .notNull()
      .references(() => profiles.did, { onDelete: 'cascade' }),
    positionRkey: text('position_rkey').notNull(),
    skillRkey: text('skill_rkey').notNull(),
    indexedAt: timestamp('indexed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.did, table.positionRkey, table.skillRkey] })],
);
