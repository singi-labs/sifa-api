import { describe, it, expect } from 'vitest';
import { normalizeSkillName, createSlug } from '../../src/services/skill-normalization.js';

describe('normalizeSkillName', () => {
  it('lowercases and trims input', () => {
    expect(normalizeSkillName('  React.js  ')).toBe('react.js');
  });

  it('handles mixed case', () => {
    expect(normalizeSkillName('TypeScript')).toBe('typescript');
  });

  it('preserves dots and hyphens', () => {
    expect(normalizeSkillName('Node.js')).toBe('node.js');
    expect(normalizeSkillName('vue-router')).toBe('vue-router');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeSkillName('machine   learning')).toBe('machine learning');
  });
});

describe('createSlug', () => {
  it('creates url-safe slug from skill name', () => {
    expect(createSlug('React.js')).toBe('react-js');
  });

  it('handles spaces and special chars', () => {
    expect(createSlug('C++')).toBe('c-plus-plus');
    expect(createSlug('C#')).toBe('c-sharp');
  });

  it('collapses multiple hyphens', () => {
    expect(createSlug('Node.js / Express')).toBe('node-js-express');
  });
});
