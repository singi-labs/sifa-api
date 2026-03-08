import type { JetstreamEvent } from './types.js';
import { logger } from '../logger.js';

export interface IndexerMap {
  profileIndexer?: (event: JetstreamEvent) => Promise<void>;
  positionIndexer?: (event: JetstreamEvent) => Promise<void>;
  educationIndexer?: (event: JetstreamEvent) => Promise<void>;
  skillIndexer?: (event: JetstreamEvent) => Promise<void>;
  followIndexer?: (event: JetstreamEvent) => Promise<void>;
}

const COLLECTION_MAP: Record<string, keyof IndexerMap> = {
  'id.sifa.profile.self': 'profileIndexer',
  'id.sifa.profile.position': 'positionIndexer',
  'id.sifa.profile.education': 'educationIndexer',
  'id.sifa.profile.skill': 'skillIndexer',
  'id.sifa.graph.follow': 'followIndexer',
};

export function createEventRouter(indexers: IndexerMap) {
  return async (event: JetstreamEvent) => {
    if (event.kind !== 'commit' || !event.commit) return;

    const indexerKey = COLLECTION_MAP[event.commit.collection];
    if (!indexerKey) return;

    const indexer = indexers[indexerKey];
    if (!indexer) {
      logger.warn({ collection: event.commit.collection }, 'No indexer registered');
      return;
    }

    await indexer(event);
  };
}
