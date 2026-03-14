import { Agent } from '@atproto/api';
import type { OAuthSession } from '@atproto/oauth-client';
import { eq } from 'drizzle-orm';
import { buildApplyWritesOp, writeToUserPds } from './pds-writer.js';
import type { ApplyWritesOp } from './pds-writer.js';
import type { Database } from '../db/index.js';
import { profiles, externalAccountVerifications } from '../db/schema/index.js';

const SIFA_COLLECTIONS = [
  'id.sifa.profile.self',
  'id.sifa.profile.position',
  'id.sifa.profile.education',
  'id.sifa.profile.skill',
  'id.sifa.profile.certification',
  'id.sifa.profile.project',
  'id.sifa.profile.volunteering',
  'id.sifa.profile.publication',
  'id.sifa.profile.course',
  'id.sifa.profile.honor',
  'id.sifa.profile.language',
  'id.sifa.profile.externalAccount',
] as const;

export { SIFA_COLLECTIONS };

export async function buildPdsDeleteOps(
  agent: Agent,
  did: string,
  collections: readonly string[],
): Promise<ApplyWritesOp[]> {
  const ops: ApplyWritesOp[] = [];
  for (const collection of collections) {
    const existing = await agent.com.atproto.repo.listRecords({
      repo: did,
      collection,
      limit: 100,
    });
    for (const rec of existing.data.records) {
      const rkey = rec.uri.split('/').pop() ?? '';
      if (rkey) ops.push(buildApplyWritesOp('delete', collection, rkey));
    }
  }
  return ops;
}

export async function wipeSifaData(
  session: OAuthSession,
  did: string,
  db: Database,
): Promise<void> {
  const agent = new Agent(session);
  const ops = await buildPdsDeleteOps(agent, did, SIFA_COLLECTIONS);
  if (ops.length > 0) {
    await writeToUserPds(session, did, ops);
  }
  await db.delete(profiles).where(eq(profiles.did, did));
  await db.delete(externalAccountVerifications).where(eq(externalAccountVerifications.did, did));
}
