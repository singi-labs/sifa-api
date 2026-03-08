import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const oauthSessions = pgTable('oauth_sessions', {
  sessionId: text('session_id').primaryKey(),
  did: text('did').notNull(),
  handle: text('handle').notNull(),
  pdsUrl: text('pds_url').notNull(),
  tokenSet: jsonb('token_set').notNull(),
  dpopKey: jsonb('dpop_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
