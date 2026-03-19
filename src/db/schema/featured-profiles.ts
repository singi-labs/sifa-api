import { pgTable, serial, text, date, timestamp } from 'drizzle-orm/pg-core';

export const featuredProfiles = pgTable('featured_profiles', {
  id: serial('id').primaryKey(),
  did: text('did').notNull(),
  featuredDate: date('featured_date').notNull().unique(),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
