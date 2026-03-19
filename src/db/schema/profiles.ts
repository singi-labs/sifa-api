import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';

export const profiles = pgTable(
  'profiles',
  {
    did: text('did').primaryKey(),
    handle: text('handle').notNull(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    headline: text('headline'),
    about: text('about'),
    headlineOverride: text('headline_override'),
    aboutOverride: text('about_override'),
    industry: text('industry'),
    locationCountry: text('location_country'),
    locationRegion: text('location_region'),
    locationCity: text('location_city'),
    countryCode: text('country_code'),
    openTo: text('open_to').array(),
    preferredWorkplace: text('preferred_workplace').array(),
    langs: text('langs').array(),
    pdsHost: text('pds_host'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    indexedAt: timestamp('indexed_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
  },
  (table) => [index('idx_profiles_handle').on(table.handle)],
);
