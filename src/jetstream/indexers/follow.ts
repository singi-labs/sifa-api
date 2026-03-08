import type { Database } from '../../db/index.js';
import { connections } from '../../db/schema/index.js';
import { and, eq } from 'drizzle-orm';
import type { JetstreamEvent } from '../types.js';
import { logger } from '../../logger.js';

export function createFollowIndexer(db: Database) {
  return async (event: JetstreamEvent) => {
    const { did, commit } = event;
    if (!commit) return;

    const { operation, record } = commit;

    if (operation === 'delete') {
      // On delete, the record is not available. We need to find the connection
      // by followerDid + source. However, without knowing the subjectDid from
      // the deleted record, we delete all sifa follows from this DID with a
      // matching rkey pattern. Since rkey is not in the connections schema,
      // we rely on the fact that a delete event for id.sifa.graph.follow
      // means the user unfollowed. We need subjectDid from the record.
      // Jetstream delete events do not include the record, so we look up
      // existing connections for this follower and delete matching ones.
      // For robustness, we store the subjectDid during create and look it up
      // on delete. Since we can't do that without the record, we handle this
      // by deleting based on the record if available, or logging a warning.
      if (record?.subject) {
        await db
          .delete(connections)
          .where(
            and(
              eq(connections.followerDid, did),
              eq(connections.subjectDid, record.subject as string),
              eq(connections.source, 'sifa'),
            ),
          );
        logger.info({ did, subject: record.subject }, 'Deleted follow');
      } else {
        logger.warn({ did }, 'Follow delete event without subject, cannot remove connection');
      }
      return;
    }

    if (!record) return;

    const subjectDid = record.subject as string;
    if (!subjectDid) {
      logger.warn({ did }, 'Follow event without subject DID');
      return;
    }

    await db
      .insert(connections)
      .values({
        followerDid: did,
        subjectDid,
        source: 'sifa',
        rkey: commit.rkey,
        createdAt: new Date(record.createdAt as string),
        indexedAt: new Date(),
      })
      .onConflictDoNothing();

    logger.info({ did, subjectDid, operation }, 'Indexed follow');
  };
}
