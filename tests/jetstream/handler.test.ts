import { describe, it, expect, vi } from 'vitest';
import { createEventRouter } from '../../src/jetstream/handler.js';

describe('Event router', () => {
  it('routes profile.self events to profile indexer', async () => {
    const profileIndexer = vi.fn();
    const router = createEventRouter({ profileIndexer });

    await router({
      did: 'did:plc:test',
      time_us: 1234567890,
      kind: 'commit',
      commit: {
        rev: 'rev1',
        operation: 'create',
        collection: 'id.sifa.profile.self',
        rkey: 'self',
        record: { headline: 'Test', createdAt: '2026-01-01T00:00:00Z' },
      },
    });

    expect(profileIndexer).toHaveBeenCalledOnce();
  });

  it('ignores unknown collections', async () => {
    const profileIndexer = vi.fn();
    const router = createEventRouter({ profileIndexer });

    await router({
      did: 'did:plc:test',
      time_us: 1234567890,
      kind: 'commit',
      commit: {
        rev: 'rev1',
        operation: 'create',
        collection: 'app.bsky.feed.post',
        rkey: '123',
        record: {},
      },
    });

    expect(profileIndexer).not.toHaveBeenCalled();
  });

  it('routes position events to position indexer', async () => {
    const positionIndexer = vi.fn();
    const router = createEventRouter({ positionIndexer });

    await router({
      did: 'did:plc:test',
      time_us: 1234567890,
      kind: 'commit',
      commit: {
        rev: 'rev1',
        operation: 'create',
        collection: 'id.sifa.profile.position',
        rkey: '3abc',
        record: { companyName: 'Acme', title: 'Eng' },
      },
    });

    expect(positionIndexer).toHaveBeenCalledOnce();
  });

  it('routes education events to education indexer', async () => {
    const educationIndexer = vi.fn();
    const router = createEventRouter({ educationIndexer });

    await router({
      did: 'did:plc:test',
      time_us: 1234567890,
      kind: 'commit',
      commit: {
        rev: 'rev1',
        operation: 'create',
        collection: 'id.sifa.profile.education',
        rkey: '3abc',
        record: { institution: 'MIT', degree: 'BS' },
      },
    });

    expect(educationIndexer).toHaveBeenCalledOnce();
  });

  it('routes skill events to skill indexer', async () => {
    const skillIndexer = vi.fn();
    const router = createEventRouter({ skillIndexer });

    await router({
      did: 'did:plc:test',
      time_us: 1234567890,
      kind: 'commit',
      commit: {
        rev: 'rev1',
        operation: 'create',
        collection: 'id.sifa.profile.skill',
        rkey: '3abc',
        record: { skillName: 'TypeScript', category: 'Programming' },
      },
    });

    expect(skillIndexer).toHaveBeenCalledOnce();
  });

  it('routes follow events to follow indexer', async () => {
    const followIndexer = vi.fn();
    const router = createEventRouter({ followIndexer });

    await router({
      did: 'did:plc:test',
      time_us: 1234567890,
      kind: 'commit',
      commit: {
        rev: 'rev1',
        operation: 'create',
        collection: 'id.sifa.graph.follow',
        rkey: '3abc',
        record: { subject: 'did:plc:other' },
      },
    });

    expect(followIndexer).toHaveBeenCalledOnce();
  });

  it('ignores non-commit events', async () => {
    const profileIndexer = vi.fn();
    const router = createEventRouter({ profileIndexer });

    await router({
      did: 'did:plc:test',
      time_us: 1234567890,
      kind: 'identity',
      identity: {
        did: 'did:plc:test',
        handle: 'test.bsky.social',
      },
    });

    expect(profileIndexer).not.toHaveBeenCalled();
  });

  it('passes full event to indexer', async () => {
    const profileIndexer = vi.fn();
    const router = createEventRouter({ profileIndexer });

    const event = {
      did: 'did:plc:test',
      time_us: 1234567890,
      kind: 'commit' as const,
      commit: {
        rev: 'rev1',
        operation: 'create' as const,
        collection: 'id.sifa.profile.self',
        rkey: 'self',
        record: { headline: 'Test', createdAt: '2026-01-01T00:00:00Z' },
      },
    };

    await router(event);

    expect(profileIndexer).toHaveBeenCalledWith(event);
  });
});
