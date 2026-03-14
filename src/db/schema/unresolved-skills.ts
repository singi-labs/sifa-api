import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { canonicalSkills } from './canonical-skills.js';

export const unresolvedSkills = pgTable('unresolved_skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  rawName: text('raw_name').notNull(),
  normalizedName: text('normalized_name').notNull().unique(),
  occurrences: integer('occurrences').notNull().default(1),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedToId: uuid('resolved_to_id').references(() => canonicalSkills.id),
});
