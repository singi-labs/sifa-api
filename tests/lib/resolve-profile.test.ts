import { describe, it, expect } from 'vitest';
import { resolveProfileFields } from '../../src/lib/resolve-profile.js';

describe('resolveProfileFields', () => {
  const source = {
    headline: 'ATProto headline',
    about: 'ATProto bio text',
  };

  it('returns source values when no overrides exist', () => {
    const result = resolveProfileFields(source, { headline: null, about: null });
    expect(result.headline).toBe('ATProto headline');
    expect(result.about).toBe('ATProto bio text');
  });

  it('uses override when present', () => {
    const result = resolveProfileFields(source, {
      headline: 'Custom headline',
      about: null,
    });
    expect(result.headline).toBe('Custom headline');
    expect(result.about).toBe('ATProto bio text');
  });

  it('uses override for both fields', () => {
    const result = resolveProfileFields(source, {
      headline: 'Custom headline',
      about: 'Custom about',
    });
    expect(result.headline).toBe('Custom headline');
    expect(result.about).toBe('Custom about');
  });

  it('handles null source with override', () => {
    const result = resolveProfileFields(
      { headline: null, about: null },
      { headline: 'Override', about: null },
    );
    expect(result.headline).toBe('Override');
    expect(result.about).toBeNull();
  });

  it('handles null source and null override', () => {
    const result = resolveProfileFields(
      { headline: null, about: null },
      { headline: null, about: null },
    );
    expect(result.headline).toBeNull();
    expect(result.about).toBeNull();
  });

  it('returns hasOverride true when any override is set', () => {
    const result = resolveProfileFields(source, { headline: 'Custom', about: null });
    expect(result.hasHeadlineOverride).toBe(true);
    expect(result.hasAboutOverride).toBe(false);
  });

  it('returns hasOverride false when no overrides', () => {
    const result = resolveProfileFields(source, { headline: null, about: null });
    expect(result.hasHeadlineOverride).toBe(false);
    expect(result.hasAboutOverride).toBe(false);
  });
});
