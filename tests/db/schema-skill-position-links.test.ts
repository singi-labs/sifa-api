import { describe, it, expect } from 'vitest';
import { skillPositionLinks } from '../../src/db/schema/index.js';

describe('skill_position_links schema', () => {
  it('has expected columns', () => {
    expect(skillPositionLinks.did).toBeDefined();
    expect(skillPositionLinks.positionRkey).toBeDefined();
    expect(skillPositionLinks.skillRkey).toBeDefined();
    expect(skillPositionLinks.indexedAt).toBeDefined();
  });
});
