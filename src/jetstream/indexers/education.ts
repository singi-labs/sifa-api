import type { Database } from '../../db/index.js';
import type { JetstreamEvent } from '../types.js';
import { indexEducation, deleteEducation } from '../../services/record-indexer.js';

export function createEducationIndexer(db: Database) {
  return async (event: JetstreamEvent) => {
    const { did, commit } = event;
    if (!commit) return;

    const { operation, rkey, record } = commit;

    if (operation === 'delete') {
      await deleteEducation(db, did, rkey);
      return;
    }

    if (!record) return;
    await indexEducation(db, did, rkey, record);
  };
}
