import { describe, it, expect } from 'vitest';
import { mergePublications } from '../../src/services/standard-publications.js';
import type { StandardPublication } from '../../src/services/standard-publications.js';

describe('mergePublications', () => {
  const makeSifaPub = (
    overrides: Partial<{ title: string; url: string | null; date: string | null }> = {},
  ) => ({
    rkey: '3abc',
    title: overrides.title ?? 'My Article',
    publisher: 'Self',
    url: overrides.url ?? 'https://example.com/article',
    description: 'A test article',
    date: overrides.date ?? '2026-01-15',
  });

  const makeStandardPub = (overrides: Partial<StandardPublication> = {}): StandardPublication => ({
    uri: 'at://did:plc:test/site.standard.publication/3xyz',
    title: overrides.title ?? 'Standard Post',
    url: overrides.url ?? 'https://standard.app/post',
    description: overrides.description ?? 'Published on Standard',
    date: overrides.date ?? '2026-02-01',
    source: 'standard',
  });

  it('returns sifa publications with source tag when no standard publications', () => {
    const sifa = [makeSifaPub()];
    const result = mergePublications(sifa, []);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ title: 'My Article', source: 'sifa' });
  });

  it('returns standard publications when no sifa publications', () => {
    const standard = [makeStandardPub()];
    const result = mergePublications([], standard);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ title: 'Standard Post', source: 'standard' });
  });

  it('merges both sources chronologically (newest first)', () => {
    const sifa = [makeSifaPub({ date: '2026-01-01' })];
    const standard = [makeStandardPub({ date: '2026-02-01' })];
    const result = mergePublications(sifa, standard);
    expect(result).toHaveLength(2);
    expect(result[0]?.source).toBe('standard');
    expect(result[1]?.source).toBe('sifa');
  });

  it('deduplicates by URL (sifa wins)', () => {
    const url = 'https://example.com/same-article';
    const sifa = [makeSifaPub({ url })];
    const standard = [makeStandardPub({ url })];
    const result = mergePublications(sifa, standard);
    expect(result).toHaveLength(1);
    expect(result[0]?.source).toBe('sifa');
  });

  it('deduplicates by title case-insensitively (sifa wins)', () => {
    const sifa = [makeSifaPub({ title: 'My Article', url: 'https://a.com' })];
    const standard = [makeStandardPub({ title: 'my article', url: 'https://b.com' })];
    const result = mergePublications(sifa, standard);
    expect(result).toHaveLength(1);
    expect(result[0]?.source).toBe('sifa');
  });

  it('keeps standard publication when no URL or title match', () => {
    const sifa = [makeSifaPub({ title: 'Sifa Article', url: 'https://sifa.com' })];
    const standard = [makeStandardPub({ title: 'Different Article', url: 'https://other.com' })];
    const result = mergePublications(sifa, standard);
    expect(result).toHaveLength(2);
  });

  it('handles null URLs without false deduplication', () => {
    const sifa = [makeSifaPub({ title: 'Article A', url: null })];
    const standard = [makeStandardPub({ title: 'Article B', url: null })];
    const result = mergePublications(sifa, standard);
    expect(result).toHaveLength(2);
  });

  it('handles null dates gracefully (sorted last)', () => {
    const sifa = [makeSifaPub({ date: null })];
    const standard = [makeStandardPub({ date: '2026-03-01' })];
    const result = mergePublications(sifa, standard);
    expect(result).toHaveLength(2);
    expect(result[0]?.source).toBe('standard');
    expect(result[1]?.source).toBe('sifa');
  });

  it('returns empty array when both inputs are empty', () => {
    expect(mergePublications([], [])).toEqual([]);
  });
});
