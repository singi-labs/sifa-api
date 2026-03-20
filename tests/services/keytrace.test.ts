import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  fetchKeytraceClaims,
  matchClaimsToAccounts,
  mergeExternalAccounts,
  type KeytraceClaim,
  type SifaExternalAccount,
} from '../../src/services/keytrace.js';

const { mockListRecords } = vi.hoisted(() => {
  const mockListRecords = vi.fn();
  return { mockListRecords };
});

vi.mock('@atproto/api', () => ({
  Agent: class MockAgent {
    com = {
      atproto: {
        repo: {
          listRecords: mockListRecords,
        },
      },
    };
  },
}));

function makeClaim(overrides: Partial<KeytraceClaim> = {}): KeytraceClaim {
  return {
    rkey: 'claim1',
    platform: 'github',
    url: 'https://github.com/gxjansen',
    claimedAt: '2026-03-15T00:00:00Z',
    ...overrides,
  };
}

function makeSifaAccount(overrides: Partial<SifaExternalAccount> = {}): SifaExternalAccount {
  return {
    rkey: 'acc1',
    platform: 'github',
    url: 'https://github.com/gxjansen',
    label: null,
    feedUrl: null,
    isPrimary: false,
    verified: false,
    verifiedVia: null,
    verifiable: true,
    ...overrides,
  };
}

describe('keytrace', () => {
  describe('fetchKeytraceClaims', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('returns cached claims when available', async () => {
      const mockValkey = {
        get: vi.fn().mockResolvedValue(JSON.stringify([makeClaim()])),
        setex: vi.fn(),
      };

      const claims = await fetchKeytraceClaims(
        'did:plc:test',
        'pds.example.com',
        mockValkey as never,
      );
      expect(claims).toHaveLength(1);
      expect(claims[0]?.platform).toBe('github');
      expect(mockValkey.get).toHaveBeenCalledWith('keytrace:claims:did:plc:test');
    });

    it('returns empty array when PDS fetch fails', async () => {
      mockListRecords.mockRejectedValueOnce(new Error('PDS down'));

      const mockValkey = {
        get: vi.fn().mockResolvedValue(null),
        setex: vi.fn(),
      };

      const claims = await fetchKeytraceClaims(
        'did:plc:test',
        'pds.example.com',
        mockValkey as never,
      );
      expect(claims).toEqual([]);
    });

    it('returns empty array when valkey is null', async () => {
      mockListRecords.mockResolvedValueOnce({
        data: {
          records: [
            {
              uri: 'at://did:plc:test/dev.keytrace.claim/abc123',
              value: {
                url: 'https://github.com/gxjansen',
                platform: 'github',
                createdAt: '2026-03-15T00:00:00Z',
              },
            },
          ],
        },
      });

      const claims = await fetchKeytraceClaims('did:plc:test', 'pds.example.com', null);
      expect(claims).toHaveLength(1);
      expect(claims[0]?.platform).toBe('github');
    });

    it('caches fetched claims in valkey with 2h TTL', async () => {
      mockListRecords.mockResolvedValueOnce({
        data: {
          records: [
            {
              uri: 'at://did:plc:test/dev.keytrace.claim/abc123',
              value: {
                url: 'https://github.com/gxjansen',
                platform: 'github',
                createdAt: '2026-03-15T00:00:00Z',
              },
            },
          ],
        },
      });

      const mockValkey = {
        get: vi.fn().mockResolvedValue(null),
        setex: vi.fn(),
      };

      await fetchKeytraceClaims('did:plc:test', 'pds.example.com', mockValkey as never);
      expect(mockValkey.setex).toHaveBeenCalledWith(
        'keytrace:claims:did:plc:test',
        7200,
        expect.any(String),
      );
    });

    it('skips malformed records', async () => {
      mockListRecords.mockResolvedValueOnce({
        data: {
          records: [
            {
              uri: 'at://did:plc:test/dev.keytrace.claim/good',
              value: {
                url: 'https://github.com/gxjansen',
                platform: 'github',
                createdAt: '2026-03-15T00:00:00Z',
              },
            },
            {
              uri: 'at://did:plc:test/dev.keytrace.claim/bad',
              value: {
                // missing url and platform
                createdAt: '2026-03-15T00:00:00Z',
              },
            },
          ],
        },
      });

      const claims = await fetchKeytraceClaims('did:plc:test', 'pds.example.com', null);
      expect(claims).toHaveLength(1);
    });
  });

  describe('matchClaimsToAccounts', () => {
    it('matches by exact normalized URL', () => {
      const claims = [makeClaim({ url: 'https://github.com/gxjansen/' })];
      const accounts = [makeSifaAccount({ url: 'https://github.com/gxjansen' })];

      const result = matchClaimsToAccounts(claims, accounts);
      expect(result.matched.size).toBe(1);
      expect(result.matched.get('acc1')?.rkey).toBe('claim1');
      expect(result.unmatched).toHaveLength(0);
    });

    it('matches by platform + username fallback', () => {
      const claims = [makeClaim({ url: 'https://github.com/gxjansen' })];
      const accounts = [
        makeSifaAccount({ url: 'https://www.github.com/gxjansen/repos', rkey: 'acc1' }),
      ];

      const result = matchClaimsToAccounts(claims, accounts);
      expect(result.matched.size).toBe(1);
    });

    it('returns unmatched claims when no Sifa account matches', () => {
      const claims = [makeClaim({ platform: 'twitter', url: 'https://x.com/guido' })];
      const accounts = [makeSifaAccount({ platform: 'github', url: 'https://github.com/other' })];

      const result = matchClaimsToAccounts(claims, accounts);
      expect(result.matched.size).toBe(0);
      expect(result.unmatched).toHaveLength(1);
    });

    it('handles empty claims array', () => {
      const result = matchClaimsToAccounts([], [makeSifaAccount()]);
      expect(result.matched.size).toBe(0);
      expect(result.unmatched).toHaveLength(0);
    });

    it('handles empty accounts array', () => {
      const claims = [makeClaim()];
      const result = matchClaimsToAccounts(claims, []);
      expect(result.matched.size).toBe(0);
      expect(result.unmatched).toHaveLength(1);
    });
  });

  describe('mergeExternalAccounts', () => {
    it('marks matched Sifa accounts as keytrace-verified', () => {
      const accounts = [makeSifaAccount()];
      const claims = [makeClaim()];

      const result = mergeExternalAccounts(accounts, claims);
      expect(result).toHaveLength(1);
      expect(result[0]?.source).toBe('sifa');
      expect(result[0]?.keytraceVerified).toBe(true);
      expect(result[0]?.keytraceClaim).toBeDefined();
      expect(result[0]?.keytraceClaim?.rkey).toBe('claim1');
    });

    it('leaves unmatched Sifa accounts unchanged', () => {
      const accounts = [
        makeSifaAccount({ platform: 'linkedin', url: 'https://linkedin.com/in/gxjansen' }),
      ];
      const claims = [makeClaim({ platform: 'github', url: 'https://github.com/gxjansen' })];

      const result = mergeExternalAccounts(accounts, claims);
      const sifaEntry = result.find((r) => r.source === 'sifa');
      const keytraceEntry = result.find((r) => r.source === 'keytrace');

      expect(sifaEntry?.keytraceVerified).toBe(false);
      expect(keytraceEntry?.keytraceVerified).toBe(true);
    });

    it('appends unmatched Keytrace claims as keytrace-source entries', () => {
      const accounts: SifaExternalAccount[] = [];
      const claims = [makeClaim()];

      const result = mergeExternalAccounts(accounts, claims);
      expect(result).toHaveLength(1);
      expect(result[0]?.source).toBe('keytrace');
      expect(result[0]?.keytraceVerified).toBe(true);
      expect(result[0]?.platform).toBe('github');
      expect(result[0]?.isPrimary).toBe(false);
      expect(result[0]?.verified).toBe(false);
      expect(result[0]?.verifiedVia).toBeNull();
    });

    it('returns only Sifa accounts when claims is empty', () => {
      const accounts = [makeSifaAccount()];

      const result = mergeExternalAccounts(accounts, []);
      expect(result).toHaveLength(1);
      expect(result[0]?.source).toBe('sifa');
      expect(result[0]?.keytraceVerified).toBe(false);
    });

    it('returns empty array when both are empty', () => {
      const result = mergeExternalAccounts([], []);
      expect(result).toEqual([]);
    });
  });
});
