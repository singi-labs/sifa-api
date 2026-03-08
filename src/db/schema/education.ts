import { pgTable, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { profiles } from './profiles.js';

export const education = pgTable(
  'education',
  {
    did: text('did')
      .notNull()
      .references(() => profiles.did, { onDelete: 'cascade' }),
    rkey: text('rkey').notNull(),
    institution: text('institution').notNull(),
    institutionDid: text('institution_did'),
    degree: text('degree'),
    fieldOfStudy: text('field_of_study'),
    description: text('description'),
    startDate: text('start_date'),
    endDate: text('end_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    indexedAt: timestamp('indexed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.did, table.rkey] })],
);
