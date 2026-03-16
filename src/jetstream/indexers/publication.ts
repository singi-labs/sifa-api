import type { Database } from '../../db/index.js';
import type { JetstreamEvent } from '../types.js';
import { indexRecord, deleteRecord } from '../../services/record-indexer.js';

const COLLECTION = 'id.sifa.profile.publication';

export function createPublicationIndexer(db: Database) {
  return async (event: JetstreamEvent) => {
    const { did, commit } = event;
    if (!commit) return;

    const { operation, rkey, record } = commit;

    if (operation === 'delete') {
      await deleteRecord(db, COLLECTION, did, rkey);
      return;
    }

    if (!record) return;
    await indexRecord(db, COLLECTION, did, rkey, record);
  };
}
