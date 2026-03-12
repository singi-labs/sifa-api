import { pgTable, text, timestamp, primaryKey, index } from 'drizzle-orm/pg-core';

export const invites = pgTable(
  'invites',
  {
    inviterDid: text('inviter_did').notNull(),
    subjectDid: text('subject_did').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.inviterDid, table.subjectDid] }),
    index('idx_invites_subject').on(table.subjectDid),
  ],
);
