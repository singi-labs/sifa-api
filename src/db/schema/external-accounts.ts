import { pgTable, text, timestamp, boolean, primaryKey } from 'drizzle-orm/pg-core';
import { profiles } from './profiles.js';

export const externalAccounts = pgTable(
  'external_accounts',
  {
    did: text('did')
      .notNull()
      .references(() => profiles.did, { onDelete: 'cascade' }),
    rkey: text('rkey').notNull(),
    platform: text('platform').notNull(),
    url: text('url').notNull(),
    label: text('label'),
    feedUrl: text('feed_url'),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    indexedAt: timestamp('indexed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.did, table.rkey] })],
);

export const externalAccountVerifications = pgTable(
  'external_account_verifications',
  {
    did: text('did').notNull(),
    url: text('url').notNull(),
    verified: boolean('verified').notNull().default(false),
    verifiedVia: text('verified_via'),
    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.did, table.url] })],
);
