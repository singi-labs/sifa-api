import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Database } from './index.js';

export async function runMigrations(db: Database) {
  await migrate(db, { migrationsFolder: './drizzle' });
}
