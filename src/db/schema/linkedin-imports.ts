import { pgTable, serial, text, boolean, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { profiles } from './profiles.js';

export const linkedinImports = pgTable(
  'linkedin_imports',
  {
    id: serial('id').primaryKey(),
    did: text('did')
      .notNull()
      .references(() => profiles.did),
    success: boolean('success').notNull(),
    positionCount: integer('position_count').notNull().default(0),
    educationCount: integer('education_count').notNull().default(0),
    skillCount: integer('skill_count').notNull().default(0),
    certificationCount: integer('certification_count').notNull().default(0),
    projectCount: integer('project_count').notNull().default(0),
    volunteeringCount: integer('volunteering_count').notNull().default(0),
    publicationCount: integer('publication_count').notNull().default(0),
    courseCount: integer('course_count').notNull().default(0),
    honorCount: integer('honor_count').notNull().default(0),
    languageCount: integer('language_count').notNull().default(0),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_linkedin_imports_created_at').on(table.createdAt)],
);
