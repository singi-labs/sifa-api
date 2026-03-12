import { describe, it, expect } from 'vitest';
import { invites } from '../../../src/db/schema/invites.js';

describe('invites schema', () => {
  it('exports a table with expected columns', () => {
    expect(invites).toBeDefined();
    const columns = Object.keys(invites);
    expect(columns).toContain('inviterDid');
    expect(columns).toContain('subjectDid');
    expect(columns).toContain('createdAt');
  });
});
