import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

const db = drizzle(url);
await migrate(db, { migrationsFolder: './drizzle' });
console.log('Migrations complete');
process.exit(0);
