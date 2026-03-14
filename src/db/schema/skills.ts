import { pgTable, text, timestamp, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './profiles.js';
import { canonicalSkills } from './canonical-skills.js';

export const skills = pgTable(
  'skills',
  {
    did: text('did')
      .notNull()
      .references(() => profiles.did, { onDelete: 'cascade' }),
    rkey: text('rkey').notNull(),
    skillName: text('skill_name').notNull(),
    category: text('category'),
    canonicalSkillId: uuid('canonical_skill_id').references(() => canonicalSkills.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    indexedAt: timestamp('indexed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.did, table.rkey] })],
);
