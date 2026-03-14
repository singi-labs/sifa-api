import { describe, it, expect } from 'vitest';
import { unresolvedSkills } from '../../src/db/schema/index.js';

describe('unresolved_skills schema', () => {
  it('has expected columns', () => {
    expect(unresolvedSkills.id).toBeDefined();
    expect(unresolvedSkills.rawName).toBeDefined();
    expect(unresolvedSkills.normalizedName).toBeDefined();
    expect(unresolvedSkills.occurrences).toBeDefined();
    expect(unresolvedSkills.firstSeenAt).toBeDefined();
    expect(unresolvedSkills.resolvedAt).toBeDefined();
    expect(unresolvedSkills.resolvedToId).toBeDefined();
  });
});
