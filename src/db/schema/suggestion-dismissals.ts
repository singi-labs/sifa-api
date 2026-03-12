import { pgTable, text, timestamp, primaryKey, index } from 'drizzle-orm/pg-core';

export const suggestionDismissals = pgTable(
  'suggestion_dismissals',
  {
    userDid: text('user_did').notNull(),
    subjectDid: text('subject_did').notNull(),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userDid, table.subjectDid] }),
    index('idx_suggestion_dismissals_user').on(table.userDid),
  ],
);
