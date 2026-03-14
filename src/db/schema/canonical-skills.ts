import { pgTable, text, integer, uuid } from 'drizzle-orm/pg-core';

export const canonicalSkills = pgTable('canonical_skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  canonicalName: text('canonical_name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  category: text('category'),
  subcategory: text('subcategory'),
  aliases: text('aliases').array().notNull().default([]),
  wikidataId: text('wikidata_id'),
  userCount: integer('user_count').notNull().default(0),
});
