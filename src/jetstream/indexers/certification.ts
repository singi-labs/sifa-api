import type { Database } from '../../db/index.js';
import { certifications } from '../../db/schema/index.js';
import { and, eq } from 'drizzle-orm';
import type { JetstreamEvent } from '../types.js';
import { logger } from '../../logger.js';
import { sanitize, sanitizeOptional } from '../../lib/sanitize.js';

export function createCertificationIndexer(db: Database) {
  return async (event: JetstreamEvent) => {
    const { did, commit } = event;
    if (!commit) return;

    const { operation, rkey, record } = commit;

    if (operation === 'delete') {
      await db
        .delete(certifications)
        .where(and(eq(certifications.did, did), eq(certifications.rkey, rkey)));
      logger.info({ did, rkey }, 'Deleted certification');
      return;
    }

    if (!record) return;

    await db
      .insert(certifications)
      .values({
        did,
        rkey,
        name: sanitize(record.name as string),
        authority: sanitizeOptional(record.authority as string | undefined) ?? null,
        credentialId: (record.credentialId as string) ?? null,
        credentialUrl: (record.credentialUrl as string) ?? null,
        issuedAt: (record.issuedAt as string) ?? null,
        expiresAt: (record.expiresAt as string) ?? null,
        createdAt: new Date(record.createdAt as string),
        indexedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [certifications.did, certifications.rkey],
        set: {
          name: sanitize(record.name as string),
          authority: sanitizeOptional(record.authority as string | undefined) ?? null,
          credentialId: (record.credentialId as string) ?? null,
          credentialUrl: (record.credentialUrl as string) ?? null,
          issuedAt: (record.issuedAt as string) ?? null,
          expiresAt: (record.expiresAt as string) ?? null,
          indexedAt: new Date(),
        },
      });

    logger.info({ did, rkey, operation }, 'Indexed certification');
  };
}
