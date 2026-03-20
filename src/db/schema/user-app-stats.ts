import { pgTable, text, timestamp, boolean, integer, primaryKey, index } from 'drizzle-orm/pg-core';
import { profiles } from './profiles.js';

export const userAppStats = pgTable(
  'user_app_stats',
  {
    did: text('did')
      .notNull()
      .references(() => profiles.did, { onDelete: 'cascade' }),
    appId: text('app_id').notNull(),
    isActive: boolean('is_active').notNull().default(false),
    recentCount: integer('recent_count').notNull().default(0),
    latestRecordAt: timestamp('latest_record_at', { withTimezone: true }),
    refreshedAt: timestamp('refreshed_at', { withTimezone: true }).notNull().defaultNow(),
    visible: boolean('visible').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.did, table.appId] }),
    index('idx_user_app_stats_app_count').on(table.appId, table.recentCount),
    index('idx_user_app_stats_refreshed').on(table.refreshedAt),
    index('idx_user_app_stats_visible').on(table.did, table.visible, table.recentCount),
  ],
);
