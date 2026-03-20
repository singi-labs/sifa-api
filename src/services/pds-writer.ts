import { TID } from '@atproto/common-web';
import { Agent } from '@atproto/api';
import type { OAuthSession } from '@atproto/oauth-client';
import type { FastifyReply } from 'fastify';

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
    $type:
      action === 'create'
        ? ('com.atproto.repo.applyWrites#create' as const)
        : ('com.atproto.repo.applyWrites#update' as const),
    collection,
    rkey,
    value: { $type: collection, ...record },
  };
}

export async function writeToUserPds(session: OAuthSession, repo: string, writes: ApplyWritesOp[]) {
  const agent = new Agent(session);
  return agent.com.atproto.repo.applyWrites({
    repo,
    writes,
  });
}

export async function pdsRecordExists(
  session: OAuthSession,
  repo: string,
  collection: string,
  rkey: string,
): Promise<boolean> {
  const agent = new Agent(session);
  try {
    await agent.com.atproto.repo.getRecord({ repo, collection, rkey });
    return true;
  } catch {
    return false;
  }
}

export function isPdsRecordNotFound(err: unknown): boolean {
  return (
    err instanceof Error &&
    'status' in err &&
    (err as { status: number }).status === 400 &&
    'error' in err &&
    (err as { error: string }).error === 'InvalidRequest' &&
    err.message?.includes('Could not find record')
  );
}

export function handlePdsError(err: unknown, reply: FastifyReply): FastifyReply {
  if (err instanceof Error && 'status' in err) {
    const status = (err as unknown as { status: number }).status;
    const error = 'error' in err ? (err as unknown as { error: string }).error : 'PdsError';
    return reply
      .status(status >= 400 && status < 600 ? status : 502)
      .send({ error, message: err.message ?? 'PDS request failed' });
  }
  throw err;
}
