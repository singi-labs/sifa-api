import { pgTable, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { profiles } from './profiles.js';

export const certifications = pgTable(
  'certifications',
  {
    did: text('did')
      .notNull()
      .references(() => profiles.did, { onDelete: 'cascade' }),
    rkey: text('rkey').notNull(),
    name: text('name').notNull(),
    authority: text('authority'),
    credentialId: text('credential_id'),
    credentialUrl: text('credential_url'),
    issuedAt: text('issued_at'),
    expiresAt: text('expires_at'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    indexedAt: timestamp('indexed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.did, table.rkey] })],
);
