import { pgTable, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { profiles } from './profiles.js';

export const skills = pgTable('skills', {
  did: text('did').notNull().references(() => profiles.did, { onDelete: 'cascade' }),
  rkey: text('rkey').notNull(),
  skillName: text('skill_name').notNull(),
  category: text('category'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  indexedAt: timestamp('indexed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.did, table.rkey] }),
]);
