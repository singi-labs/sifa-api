import { pgTable, text, timestamp, boolean, primaryKey } from 'drizzle-orm/pg-core';
import { profiles } from './profiles.js';

export const positions = pgTable(
  'positions',
  {
    did: text('did')
      .notNull()
      .references(() => profiles.did, { onDelete: 'cascade' }),
    rkey: text('rkey').notNull(),
    companyName: text('company_name').notNull(),
    companyDid: text('company_did'),
    title: text('title').notNull(),
    description: text('description'),
    employmentType: text('employment_type'),
    workplaceType: text('workplace_type'),
    locationCountry: text('location_country'),
    locationRegion: text('location_region'),
    locationCity: text('location_city'),
    startDate: text('start_date').notNull(),
    endDate: text('end_date'),
    current: boolean('current').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    indexedAt: timestamp('indexed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.did, table.rkey] })],
);
