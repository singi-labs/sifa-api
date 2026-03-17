import { describe, it, expect, vi } from 'vitest';
import { wipeSifaData } from '../../src/services/profile-wipe.js';
import { profiles, externalAccountVerifications } from '../../src/db/schema/index.js';
import type { Database } from '../../src/db/index.js';
import type { OAuthSession } from '@atproto/oauth-client';

vi.mock('@atproto/api', () => ({
  Agent: class {
    com = {
      atproto: {
        repo: {
          listRecords: vi.fn().mockResolvedValue({ data: { records: [] } }),
        },
      },
    };
  },
}));

vi.mock('../../src/services/pds-writer.js', () => ({
  writeToUserPds: vi.fn().mockResolvedValue(undefined),
  buildApplyWritesOp: vi
    .fn()
    .mockImplementation((type: string, collection: string, rkey: string) => ({
      $type: `com.atproto.repo.applyWrites#${type}`,
      collection,
      rkey,
    })),
}));

function createMockDb() {
  const whereUpdateMock = vi.fn().mockResolvedValue(undefined);
  const setMock = vi.fn().mockReturnValue({ where: whereUpdateMock });
  const updateMock = vi.fn().mockReturnValue({ set: setMock });

  const whereDeleteMock = vi.fn().mockResolvedValue(undefined);
  const deleteMock = vi.fn().mockReturnValue({ where: whereDeleteMock });

  return {
    db: { update: updateMock, delete: deleteMock } as unknown as Database,
    mocks: { updateMock, setMock, whereUpdateMock, deleteMock, whereDeleteMock },
  };
}

const mockSession = {} as OAuthSession;

describe('wipeSifaData DB behaviour on reset', () => {
  it('updates profiles row instead of deleting it', async () => {
    const { db, mocks } = createMockDb();

    await wipeSifaData(mockSession, 'did:plc:test', db);

    expect(mocks.updateMock).toHaveBeenCalledWith(profiles);
    expect(mocks.deleteMock).not.toHaveBeenCalledWith(profiles);
  });

  it('does not include createdAt, langs, headlineOverride, aboutOverride, handle, displayName, avatarUrl, or pdsHost in the update set', async () => {
    const { db, mocks } = createMockDb();

    await wipeSifaData(mockSession, 'did:plc:test', db);

    const setArg = mocks.setMock.mock.calls[0][0] as Record<string, unknown>;
    expect(setArg).not.toHaveProperty('createdAt');
    expect(setArg).not.toHaveProperty('langs');
    expect(setArg).not.toHaveProperty('headlineOverride');
    expect(setArg).not.toHaveProperty('aboutOverride');
    expect(setArg).not.toHaveProperty('handle');
    expect(setArg).not.toHaveProperty('displayName');
    expect(setArg).not.toHaveProperty('avatarUrl');
    expect(setArg).not.toHaveProperty('pdsHost');
  });

  it('nulls all profile content fields in the update set', async () => {
    const { db, mocks } = createMockDb();

    await wipeSifaData(mockSession, 'did:plc:test', db);

    const setArg = mocks.setMock.mock.calls[0][0];
    expect(setArg).toMatchObject({
      headline: null,
      about: null,
      industry: null,
      locationCountry: null,
      locationRegion: null,
      locationCity: null,
      countryCode: null,
      openTo: null,
      preferredWorkplace: null,
    });
  });

  it('still deletes externalAccountVerifications', async () => {
    const { db, mocks } = createMockDb();

    await wipeSifaData(mockSession, 'did:plc:test', db);

    expect(mocks.deleteMock).toHaveBeenCalledWith(externalAccountVerifications);
  });
});
