import { pgTable, serial, text, integer, timestamp } from 'drizzle-orm/pg-core';

export const unresolvedSkills = pgTable('unresolved_skills', {
  id: serial('id').primaryKey(),
  rawName: text('raw_name').notNull().unique(),
  occurrences: integer('occurrences').notNull().default(1),
  resolvedTo: text('resolved_to'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
