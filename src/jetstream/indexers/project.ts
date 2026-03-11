import type { Database } from '../../db/index.js';
import { projects } from '../../db/schema/index.js';
import { and, eq } from 'drizzle-orm';
import type { JetstreamEvent } from '../types.js';
import { logger } from '../../logger.js';
import { sanitize, sanitizeOptional } from '../../lib/sanitize.js';

export function createProjectIndexer(db: Database) {
  return async (event: JetstreamEvent) => {
    const { did, commit } = event;
    if (!commit) return;

    const { operation, rkey, record } = commit;

    if (operation === 'delete') {
      await db.delete(projects).where(and(eq(projects.did, did), eq(projects.rkey, rkey)));
      logger.info({ did, rkey }, 'Deleted project');
      return;
    }

    if (!record) return;

    await db
      .insert(projects)
      .values({
        did,
        rkey,
        name: sanitize(record.name as string),
        description: sanitizeOptional(record.description as string | undefined) ?? null,
        url: (record.url as string) ?? null,
        startedAt: (record.startedAt as string) ?? null,
        endedAt: (record.endedAt as string) ?? null,
        createdAt: new Date(record.createdAt as string),
        indexedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [projects.did, projects.rkey],
        set: {
          name: sanitize(record.name as string),
          description: sanitizeOptional(record.description as string | undefined) ?? null,
          url: (record.url as string) ?? null,
          startedAt: (record.startedAt as string) ?? null,
          endedAt: (record.endedAt as string) ?? null,
          indexedAt: new Date(),
        },
      });

    logger.info({ did, rkey, operation }, 'Indexed project');
  };
}
