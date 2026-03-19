import { describe, expect, it } from 'vitest';

import {
  FEATURED_TEMPLATES,
  pickTemplate,
  renderTemplate,
} from '../../src/lib/featured-templates.js';

describe('FEATURED_TEMPLATES', () => {
  it('has at least 30 unique templates', () => {
    const unique = new Set(FEATURED_TEMPLATES);
    expect(unique.size).toBeGreaterThanOrEqual(30);
  });

  it('every template contains {displayName}', () => {
    for (const template of FEATURED_TEMPLATES) {
      expect(template).toContain('{displayName}');
    }
  });
});

describe('pickTemplate', () => {
  it('is deterministic — same date returns same index', () => {
    const idx1 = pickTemplate('2026-03-19');
    const idx2 = pickTemplate('2026-03-19');
    expect(idx1).toBe(idx2);
  });

  it('returns a valid index', () => {
    const idx = pickTemplate('2026-03-19');
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(FEATURED_TEMPLATES.length);
  });

  it('varies across different dates', () => {
    const dates = ['2026-01-01', '2026-01-02', '2026-06-15', '2026-12-31', '2027-03-19'];
    const indices = dates.map((d) => pickTemplate(d));
    const unique = new Set(indices);
    // With 5 dates and 35 templates, we expect at least 2 different indices
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });
});

describe('renderTemplate', () => {
  it('replaces {displayName} correctly', () => {
    const template = 'Meet {displayName} on Sifa';
    const result = renderTemplate(template, 'Alice Johnson', 'alice.bsky.social');
    expect(result).toBe('Meet Alice Johnson on Sifa');
  });

  it('works with actual templates from the array', () => {
    const template = FEATURED_TEMPLATES[0] ?? '';
    const result = renderTemplate(template, 'Bob Smith', 'bob.bsky.social');
    expect(result).toContain('Bob Smith');
    expect(result).not.toContain('{displayName}');
  });
});
