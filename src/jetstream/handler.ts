import type { JetstreamEvent } from './types.js';
import { logger } from '../logger.js';
import type { Database } from '../db/index.js';
import { profiles } from '../db/schema/index.js';

export interface IndexerMap {
  profileIndexer?: (event: JetstreamEvent) => Promise<void>;
  positionIndexer?: (event: JetstreamEvent) => Promise<void>;
  educationIndexer?: (event: JetstreamEvent) => Promise<void>;
  skillIndexer?: (event: JetstreamEvent) => Promise<void>;
  followIndexer?: (event: JetstreamEvent) => Promise<void>;
  externalAccountIndexer?: (event: JetstreamEvent) => Promise<void>;
}

const COLLECTION_MAP: Record<string, keyof IndexerMap> = {
  'id.sifa.profile.self': 'profileIndexer',
  'id.sifa.profile.position': 'positionIndexer',
  'id.sifa.profile.education': 'educationIndexer',
  'id.sifa.profile.skill': 'skillIndexer',
  'id.sifa.graph.follow': 'followIndexer',
  'id.sifa.profile.externalAccount': 'externalAccountIndexer',
};

export function createEventRouter(db: Database, indexers: IndexerMap) {
  return async (event: JetstreamEvent) => {
    if (event.kind === 'identity' && event.identity?.handle) {
      await db
        .insert(profiles)
        .values({
          did: event.identity.did,
          handle: event.identity.handle,
          createdAt: new Date(),
          indexedAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: profiles.did,
          set: {
            handle: event.identity.handle,
            updatedAt: new Date(),
          },
        });
      return;
    }

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
