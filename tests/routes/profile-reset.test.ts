import { describe, it, expect } from 'vitest';
import {
  wipeSifaData,
  buildPdsDeleteOps,
  SIFA_COLLECTIONS,
} from '../../src/services/profile-wipe.js';

describe('profile-wipe module', () => {
  it('exports wipeSifaData as a function', () => {
    expect(typeof wipeSifaData).toBe('function');
  });

  it('exports buildPdsDeleteOps as a function', () => {
    expect(typeof buildPdsDeleteOps).toBe('function');
  });

  it('exports SIFA_COLLECTIONS with all 12 lexicon collections', () => {
    expect(SIFA_COLLECTIONS).toHaveLength(12);
    expect(SIFA_COLLECTIONS).toContain('id.sifa.profile.self');
    expect(SIFA_COLLECTIONS).toContain('id.sifa.profile.position');
    expect(SIFA_COLLECTIONS).toContain('id.sifa.profile.skill');
    expect(SIFA_COLLECTIONS).toContain('id.sifa.profile.externalAccount');
  });
});

describe('reset and delete endpoint signatures', () => {
  it('wipeSifaData expects three parameters (session, did, db)', () => {
    // wipeSifaData(session, did, db) -> 3 params
    expect(wipeSifaData.length).toBe(3);
  });
});
