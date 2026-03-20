import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const suppressedDids = pgTable('suppressed_dids', {
  did: text('did').primaryKey(),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
});
