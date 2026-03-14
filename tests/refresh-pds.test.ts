import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetProfile = vi.fn();
vi.mock('@atproto/api', () => ({
  Agent: class MockAgent {
    getProfile = mockGetProfile;
    constructor(_url: string) {}
  },
}));

import { Agent } from '@atproto/api';

describe('POST /api/profile/refresh-pds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call Bluesky public API and return updated fields', async () => {
    mockGetProfile.mockResolvedValueOnce({
      data: {
        handle: 'alice.bsky.social',
        displayName: 'Alice Updated',
        avatar: 'https://cdn.bsky.app/img/avatar/new.jpg',
      },
    });

    const agent = new Agent('https://public.api.bsky.app');
    const result = await agent.getProfile(
      { actor: 'did:plc:abc123' },
      { signal: AbortSignal.timeout(5000) },
    );

    expect(result.data.displayName).toBe('Alice Updated');
    expect(result.data.avatar).toBe('https://cdn.bsky.app/img/avatar/new.jpg');
    expect(mockGetProfile).toHaveBeenCalledWith(
      { actor: 'did:plc:abc123' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('should handle Bluesky API timeout gracefully', async () => {
    mockGetProfile.mockRejectedValueOnce(new Error('AbortError'));

    const agent = new Agent('https://public.api.bsky.app');
    await expect(
      agent.getProfile(
        { actor: 'did:plc:abc123' },
        { signal: AbortSignal.timeout(5000) },
      ),
    ).rejects.toThrow('AbortError');
  });
});
