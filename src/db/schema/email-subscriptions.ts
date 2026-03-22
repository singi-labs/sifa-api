import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { profiles } from './profiles.js';

export const emailSubscriptions = pgTable(
  'email_subscriptions',
  {
    did: text('did')
      .primaryKey()
      .references(() => profiles.did, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    source: text('source').notNull().default('welcome'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_email_subscriptions_email').on(table.email)],
);
