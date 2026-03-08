import { describe, it, expect } from 'vitest';
import { DbSessionStore } from '../../src/oauth/session-store.js';
import { ValkeyStateStore } from '../../src/oauth/state-store.js';

describe('DbSessionStore', () => {
  it('implements NodeSavedSessionStore interface', () => {
    const store = new DbSessionStore(null as any);
    expect(typeof store.get).toBe('function');
    expect(typeof store.set).toBe('function');
    expect(typeof store.del).toBe('function');
  });
});

describe('ValkeyStateStore', () => {
  it('implements NodeSavedStateStore interface', () => {
    const store = new ValkeyStateStore(null as any);
    expect(typeof store.get).toBe('function');
    expect(typeof store.set).toBe('function');
    expect(typeof store.del).toBe('function');
  });
});
