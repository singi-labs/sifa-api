import { describe, it, expect, vi } from 'vitest';
import { buildPdsDeleteOps } from '../../src/services/profile-wipe.js';
import type { Agent } from '@atproto/api';

function createMockAgent(
  recordsByCollection: Record<string, Array<{ uri: string }>>,
): Agent {
  return {
    com: {
      atproto: {
        repo: {
          listRecords: vi.fn(async ({ collection }: { collection: string }) => ({
            data: {
              records: recordsByCollection[collection] ?? [],
            },
          })),
        },
      },
    },
  } as unknown as Agent;
}

describe('buildPdsDeleteOps', () => {
  it('returns delete ops for records returned by listRecords', async () => {
    const agent = createMockAgent({
      'id.sifa.profile.position': [
        { uri: 'at://did:plc:abc/id.sifa.profile.position/3abc' },
        { uri: 'at://did:plc:abc/id.sifa.profile.position/3def' },
      ],
    });

    const ops = await buildPdsDeleteOps(agent, 'did:plc:abc', ['id.sifa.profile.position']);

    expect(ops).toHaveLength(2);
    expect(ops[0]).toEqual({
      $type: 'com.atproto.repo.applyWrites#delete',
      collection: 'id.sifa.profile.position',
      rkey: '3abc',
    });
    expect(ops[1]).toEqual({
      $type: 'com.atproto.repo.applyWrites#delete',
      collection: 'id.sifa.profile.position',
      rkey: '3def',
    });
  });

  it('returns empty array when no records exist', async () => {
    const agent = createMockAgent({});

    const ops = await buildPdsDeleteOps(agent, 'did:plc:abc', [
      'id.sifa.profile.self',
      'id.sifa.profile.skill',
    ]);

    expect(ops).toEqual([]);
  });

  it('iterates all provided collections', async () => {
    const agent = createMockAgent({
      'id.sifa.profile.self': [
        { uri: 'at://did:plc:abc/id.sifa.profile.self/self' },
      ],
      'id.sifa.profile.skill': [
        { uri: 'at://did:plc:abc/id.sifa.profile.skill/ts' },
      ],
      'id.sifa.profile.education': [
        { uri: 'at://did:plc:abc/id.sifa.profile.education/uni1' },
      ],
    });

    const collections = [
      'id.sifa.profile.self',
      'id.sifa.profile.skill',
      'id.sifa.profile.education',
    ];

    const ops = await buildPdsDeleteOps(agent, 'did:plc:abc', collections);

    expect(ops).toHaveLength(3);

    const collectionsInOps = ops.map((op) => op.collection);
    expect(collectionsInOps).toContain('id.sifa.profile.self');
    expect(collectionsInOps).toContain('id.sifa.profile.skill');
    expect(collectionsInOps).toContain('id.sifa.profile.education');

    const listRecords = agent.com.atproto.repo.listRecords as ReturnType<typeof vi.fn>;
    expect(listRecords).toHaveBeenCalledTimes(3);
    for (const col of collections) {
      expect(listRecords).toHaveBeenCalledWith({
        repo: 'did:plc:abc',
        collection: col,
        limit: 100,
      });
    }
  });
});
