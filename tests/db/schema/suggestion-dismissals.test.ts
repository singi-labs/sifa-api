import { describe, it, expect } from 'vitest';
import { suggestionDismissals } from '../../../src/db/schema/suggestion-dismissals.js';

describe('suggestionDismissals schema', () => {
  it('exports a table with expected columns', () => {
    expect(suggestionDismissals).toBeDefined();
    const columns = Object.keys(suggestionDismissals);
    expect(columns).toContain('userDid');
    expect(columns).toContain('subjectDid');
    expect(columns).toContain('dismissedAt');
  });
});
