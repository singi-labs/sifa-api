import { describe, it, expect } from 'vitest';
import { canonicalSkills } from '../../src/db/schema/index.js';

describe('canonical_skills schema', () => {
  it('has expected columns', () => {
    expect(canonicalSkills.id).toBeDefined();
    expect(canonicalSkills.canonicalName).toBeDefined();
    expect(canonicalSkills.slug).toBeDefined();
    expect(canonicalSkills.category).toBeDefined();
    expect(canonicalSkills.subcategory).toBeDefined();
    expect(canonicalSkills.aliases).toBeDefined();
    expect(canonicalSkills.wikidataId).toBeDefined();
    expect(canonicalSkills.userCount).toBeDefined();
  });
});
