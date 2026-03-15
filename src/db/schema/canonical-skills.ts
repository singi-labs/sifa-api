import { pgTable, text, integer, uuid, timestamp } from 'drizzle-orm/pg-core';

export const canonicalSkills = pgTable('canonical_skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  canonicalName: text('canonical_name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  category: text('category').notNull().default('technical'),
  subcategory: text('subcategory'),
  aliases: text('aliases').array().notNull().default([]),
  wikidataId: text('wikidata_id'),
  userCount: integer('user_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
