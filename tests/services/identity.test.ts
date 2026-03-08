import { describe, it, expect } from 'vitest';
import { isHandle, isDid } from '../../src/services/identity.js';

describe('Identity utilities', () => {
  it('identifies handles', () => {
    expect(isHandle('alice.bsky.social')).toBe(true);
    expect(isHandle('did:plc:abc123')).toBe(false);
  });

  it('identifies DIDs', () => {
    expect(isDid('did:plc:abc123')).toBe(true);
    expect(isDid('alice.bsky.social')).toBe(false);
  });
});
