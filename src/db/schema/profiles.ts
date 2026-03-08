import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
  did: text('did').primaryKey(),
  handle: text('handle').notNull(),
  headline: text('headline'),
  about: text('about'),
  industry: text('industry'),
  locationCountry: text('location_country'),
  locationRegion: text('location_region'),
  locationCity: text('location_city'),
  website: text('website'),
  openTo: text('open_to').array(),
  preferredWorkplace: text('preferred_workplace').array(),
  langs: text('langs').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  indexedAt: timestamp('indexed_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_profiles_handle').on(table.handle),
]);
