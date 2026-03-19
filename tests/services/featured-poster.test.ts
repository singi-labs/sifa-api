import { describe, it, expect, vi } from 'vitest';
import { buildFeaturedPost, postToBluesky } from '../../src/services/featured-poster.js';
import type { PostRecord } from '../../src/services/featured-poster.js';

describe('buildFeaturedPost', () => {
  const input = {
    displayName: 'Alice Example',
    handle: 'alice.bsky.social',
    did: 'did:plc:abc123',
    dateStr: '2026-03-19',
    profileUrl: 'https://sifa.id/profile/alice.bsky.social',
  };

  it('creates post text containing displayName and @handle', () => {
    const post = buildFeaturedPost(input);
    expect(post.text).toContain('Alice Example');
    expect(post.text).toContain('@alice.bsky.social');
  });

  it('has exactly one mention facet', () => {
    const post = buildFeaturedPost(input);
    expect(post.facets).toHaveLength(1);
    expect(post.facets[0]?.features).toHaveLength(1);
    expect(post.facets[0]?.features[0]?.$type).toBe('app.bsky.richtext.facet#mention');
    expect(post.facets[0]?.features[0]?.did).toBe('did:plc:abc123');
  });

  it('has correct facet byte offsets', () => {
    const post = buildFeaturedPost(input);
    const encoder = new TextEncoder();
    const encoded = encoder.encode(post.text);
    const facet = post.facets[0];
    expect(facet).toBeDefined();
    if (!facet) return;
    const sliced = new TextDecoder().decode(
      encoded.slice(facet.index.byteStart, facet.index.byteEnd),
    );
    expect(sliced).toBe('@alice.bsky.social');
  });

  it('has correct facet byte offsets for multi-byte characters', () => {
    const multiByteInput = {
      ...input,
      displayName: 'Ren\u00e9 M\u00fcller',
    };
    const post = buildFeaturedPost(multiByteInput);
    const encoder = new TextEncoder();
    const encoded = encoder.encode(post.text);
    const facet = post.facets[0];
    expect(facet).toBeDefined();
    if (!facet) return;
    const sliced = new TextDecoder().decode(
      encoded.slice(facet.index.byteStart, facet.index.byteEnd),
    );
    expect(sliced).toBe('@alice.bsky.social');
  });

  it('has external embed with correct URI', () => {
    const post = buildFeaturedPost(input);
    expect(post.embed.$type).toBe('app.bsky.embed.external');
    expect(post.embed.external.uri).toBe('https://sifa.id/profile/alice.bsky.social');
    expect(post.embed.external.title).toBe('Alice Example on Sifa');
    expect(post.embed.external.description).toBe(
      "Check out Alice Example's professional profile on Sifa.",
    );
  });

  it('has a valid ISO timestamp for createdAt', () => {
    const post = buildFeaturedPost(input);
    const parsed = new Date(post.createdAt);
    expect(parsed.toISOString()).toBe(post.createdAt);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
  });
});

describe('postToBluesky', () => {
  const mockLog = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as import('fastify').FastifyBaseLogger;

  const samplePost: PostRecord = {
    text: 'Test post\n\n@test.bsky.social',
    facets: [
      {
        index: { byteStart: 11, byteEnd: 29 },
        features: [{ $type: 'app.bsky.richtext.facet#mention', did: 'did:plc:test' }],
      },
    ],
    embed: {
      $type: 'app.bsky.embed.external',
      external: {
        uri: 'https://sifa.id/profile/test.bsky.social',
        title: 'Test on Sifa',
        description: "Check out Test's professional profile on Sifa.",
      },
    },
    createdAt: new Date().toISOString(),
  };

  it('returns true on successful post', async () => {
    const mockAgent = {
      post: vi.fn().mockResolvedValue({}),
    } as unknown as import('@atproto/api').AtpAgent;
    const result = await postToBluesky(mockAgent, samplePost, mockLog);
    expect(result).toBe(true);
    expect(mockAgent.post).toHaveBeenCalledWith(samplePost);
    expect(mockLog.info).toHaveBeenCalled();
  });

  it('returns false and logs error on failure', async () => {
    const mockAgent = {
      post: vi.fn().mockRejectedValue(new Error('network error')),
    } as unknown as import('@atproto/api').AtpAgent;
    const result = await postToBluesky(mockAgent, samplePost, mockLog);
    expect(result).toBe(false);
    expect(mockLog.error).toHaveBeenCalled();
  });
});
