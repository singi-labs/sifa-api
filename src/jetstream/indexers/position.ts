import type { Database } from '../../db/index.js';
import type { JetstreamEvent } from '../types.js';
import { indexPosition, deletePosition } from '../../services/record-indexer.js';

export function createPositionIndexer(db: Database) {
  return async (event: JetstreamEvent) => {
    const { did, commit } = event;
    if (!commit) return;

    const { operation, rkey, record } = commit;

    if (operation === 'delete') {
      await deletePosition(db, did, rkey);
      return;
    }

    if (!record) return;
    await indexPosition(db, did, rkey, record);
  };
}
