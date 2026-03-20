import { describe, it, expect } from 'vitest';
import { resolveProfileFields } from '../../src/lib/resolve-profile.js';

describe('resolveProfileFields', () => {
  const source = {
    headline: 'ATProto headline',
    about: 'ATProto bio text',
    displayName: 'Alice',
    avatarUrl: 'https://bsky.example/avatar.jpg',
  };

  it('returns source values when no overrides exist', () => {
    const result = resolveProfileFields(source, {
      headline: null,
      about: null,
      displayName: null,
      avatarUrl: null,
    });
    expect(result.headline).toBe('ATProto headline');
    expect(result.about).toBe('ATProto bio text');
    expect(result.displayName).toBe('Alice');
    expect(result.avatarUrl).toBe('https://bsky.example/avatar.jpg');
    expect(result.hasDisplayNameOverride).toBe(false);
    expect(result.hasAvatarUrlOverride).toBe(false);
  });

  it('uses override when present', () => {
    const result = resolveProfileFields(source, {
      headline: 'Custom headline',
      about: null,
      displayName: null,
      avatarUrl: null,
    });
    expect(result.headline).toBe('Custom headline');
    expect(result.about).toBe('ATProto bio text');
  });

  it('uses override for both fields', () => {
    const result = resolveProfileFields(source, {
      headline: 'Custom headline',
      about: 'Custom about',
      displayName: null,
      avatarUrl: null,
    });
    expect(result.headline).toBe('Custom headline');
    expect(result.about).toBe('Custom about');
  });

  it('handles null source with override', () => {
    const result = resolveProfileFields(
      { headline: null, about: null, displayName: null, avatarUrl: null },
      { headline: 'Override', about: null, displayName: null, avatarUrl: null },
    );
    expect(result.headline).toBe('Override');
    expect(result.about).toBeNull();
  });

  it('handles null source and null override', () => {
    const result = resolveProfileFields(
      { headline: null, about: null, displayName: null, avatarUrl: null },
      { headline: null, about: null, displayName: null, avatarUrl: null },
    );
    expect(result.headline).toBeNull();
    expect(result.about).toBeNull();
    expect(result.displayName).toBeNull();
    expect(result.avatarUrl).toBeNull();
  });

  it('returns hasOverride true when any override is set', () => {
    const result = resolveProfileFields(source, {
      headline: 'Custom',
      about: null,
      displayName: null,
      avatarUrl: null,
    });
    expect(result.hasHeadlineOverride).toBe(true);
    expect(result.hasAboutOverride).toBe(false);
  });

  it('returns hasOverride false when no overrides', () => {
    const result = resolveProfileFields(source, {
      headline: null,
      about: null,
      displayName: null,
      avatarUrl: null,
    });
    expect(result.hasHeadlineOverride).toBe(false);
    expect(result.hasAboutOverride).toBe(false);
  });

  it('returns override displayName and avatarUrl when set', () => {
    const result = resolveProfileFields(source, {
      headline: null,
      about: null,
      displayName: 'Bob',
      avatarUrl: 'https://sifa.id/uploads/avatars/test.webp',
    });
    expect(result.displayName).toBe('Bob');
    expect(result.avatarUrl).toBe('https://sifa.id/uploads/avatars/test.webp');
    expect(result.hasDisplayNameOverride).toBe(true);
    expect(result.hasAvatarUrlOverride).toBe(true);
  });

  it('mixes overrides and source values across all fields', () => {
    const result = resolveProfileFields(
      { headline: 'src', about: 'src', displayName: 'Alice', avatarUrl: null },
      { headline: null, about: 'override about', displayName: 'Bob', avatarUrl: null },
    );
    expect(result.displayName).toBe('Bob');
    expect(result.avatarUrl).toBeNull();
    expect(result.headline).toBe('src');
    expect(result.about).toBe('override about');
    expect(result.hasDisplayNameOverride).toBe(true);
    expect(result.hasAvatarUrlOverride).toBe(false);
  });
});
