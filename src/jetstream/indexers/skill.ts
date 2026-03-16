import type { Database } from '../../db/index.js';
import type { JetstreamEvent } from '../types.js';
import { indexSkill, deleteSkill } from '../../services/record-indexer.js';

export function createSkillIndexer(db: Database) {
  return async (event: JetstreamEvent) => {
    const { did, commit } = event;
    if (!commit) return;

    const { operation, rkey, record } = commit;

    if (operation === 'delete') {
      await deleteSkill(db, did, rkey);
      return;
    }

    if (!record) return;
    await indexSkill(db, did, rkey, record);
  };
}
