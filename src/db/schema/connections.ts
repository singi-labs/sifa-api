import { pgTable, text, timestamp, primaryKey, index } from 'drizzle-orm/pg-core';

export const connections = pgTable(
  'connections',
  {
    followerDid: text('follower_did').notNull(),
    subjectDid: text('subject_did').notNull(),
    source: text('source').notNull(), // 'sifa', 'bluesky'
    rkey: text('rkey'), // nullable - Bluesky imports don't have ATproto rkeys
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    indexedAt: timestamp('indexed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.followerDid, table.subjectDid, table.source] }),
    index('idx_connections_subject').on(table.subjectDid),
    index('idx_connections_follower').on(table.followerDid),
  ],
);
