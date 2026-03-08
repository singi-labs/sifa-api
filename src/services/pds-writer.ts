import { TID } from '@atproto/common-web';
import type { Agent } from '@atproto/api';

export function generateTid(): string {
  return TID.next().toString();
}

export type ApplyWritesCreate = {
  $type: 'com.atproto.repo.applyWrites#create';
  collection: string;
  rkey: string;
  value: Record<string, unknown>;
};

export type ApplyWritesUpdate = {
  $type: 'com.atproto.repo.applyWrites#update';
  collection: string;
  rkey: string;
  value: Record<string, unknown>;
};

export type ApplyWritesDelete = {
  $type: 'com.atproto.repo.applyWrites#delete';
  collection: string;
  rkey: string;
};

export type ApplyWritesOp = ApplyWritesCreate | ApplyWritesUpdate | ApplyWritesDelete;

export function buildApplyWritesOp(
  action: 'create' | 'update' | 'delete',
  collection: string,
  rkey: string,
  record?: Record<string, unknown>,
): ApplyWritesOp {
  if (action === 'delete') {
    return {
      $type: 'com.atproto.repo.applyWrites#delete' as const,
      collection,
      rkey,
    };
  }

  return {
    $type: action === 'create'
      ? 'com.atproto.repo.applyWrites#create' as const
      : 'com.atproto.repo.applyWrites#update' as const,
    collection,
    rkey,
    value: { $type: collection, ...record },
  };
}

export async function writeToUserPds(
  agent: Agent,
  repo: string,
  writes: ApplyWritesOp[],
) {
  return agent.com.atproto.repo.applyWrites({
    repo,
    writes,
  });
}
