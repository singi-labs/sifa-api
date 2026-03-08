import { describe, it, expect } from 'vitest';
import { profiles, positions, education, skills } from '../../src/db/schema/index.js';

describe('Core schema tables', () => {
  it('profiles table has expected columns', () => {
    expect(profiles.did).toBeDefined();
    expect(profiles.handle).toBeDefined();
    expect(profiles.headline).toBeDefined();
    expect(profiles.about).toBeDefined();
    expect(profiles.indexedAt).toBeDefined();
  });

  it('positions table references profiles via did', () => {
    expect(positions.did).toBeDefined();
    expect(positions.rkey).toBeDefined();
    expect(positions.companyName).toBeDefined();
    expect(positions.title).toBeDefined();
  });

  it('education table references profiles via did', () => {
    expect(education.did).toBeDefined();
    expect(education.rkey).toBeDefined();
    expect(education.institution).toBeDefined();
  });

  it('skills table references profiles via did', () => {
    expect(skills.did).toBeDefined();
    expect(skills.rkey).toBeDefined();
    expect(skills.skillName).toBeDefined();
  });
});
