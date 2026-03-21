import { describe, it, expect } from 'vitest';
import type { ActivityItem } from '../../src/routes/activity.js';
import { aggregateByDay, computeThresholds } from '../../src/routes/activity-heatmap.js';

function makeItem(appId: string, appName: string, category: string, date: string): ActivityItem {
  return {
    uri: `at://did:plc:test/${appId}/1`,
    collection: `test.${appId}`,
    rkey: '1',
    record: { createdAt: date },
    appId,
    appName,
    category,
    indexedAt: date,
  };
}

describe('computeThresholds', () => {
  it('returns [1,2,3,4] for empty array', () => {
    expect(computeThresholds([])).toEqual([1, 2, 3, 4]);
  });

  it('returns [1,2,3,4] for all zeros', () => {
    expect(computeThresholds([0, 0, 0])).toEqual([1, 2, 3, 4]);
  });

  it('computes quantile thresholds from non-zero counts', () => {
    // 20 non-zero values: 1..20
    const counts = Array.from({ length: 20 }, (_, i) => i + 1);
    const thresholds = computeThresholds(counts);

    // 25th percentile of 1..20 = ~5, 50th = ~10, 75th = ~15, 90th = ~18
    expect(thresholds).toHaveLength(4);
    // Each threshold should be >= previous
    expect(thresholds[0]).toBeLessThanOrEqual(thresholds[1]);
    expect(thresholds[1]).toBeLessThanOrEqual(thresholds[2]);
    expect(thresholds[2]).toBeLessThanOrEqual(thresholds[3]);
    // All should be positive integers
    for (const t of thresholds) {
      expect(t).toBeGreaterThan(0);
      expect(Number.isInteger(t)).toBe(true);
    }
  });

  it('handles single non-zero value', () => {
    const thresholds = computeThresholds([5]);
    expect(thresholds).toHaveLength(4);
    // With a single value, all thresholds should equal that value
    expect(thresholds[0]).toBe(5);
    expect(thresholds[1]).toBe(5);
    expect(thresholds[2]).toBe(5);
    expect(thresholds[3]).toBe(5);
  });
});

describe('aggregateByDay', () => {
  it('returns empty for no items', () => {
    const result = aggregateByDay([]);
    expect(result).toEqual([]);
  });

  it('groups items by date and app', () => {
    const items = [
      makeItem('bluesky', 'Bluesky', 'Posts', '2026-03-15T10:00:00.000Z'),
      makeItem('bluesky', 'Bluesky', 'Posts', '2026-03-15T14:00:00.000Z'),
      makeItem('tangled', 'Tangled', 'Code', '2026-03-15T12:00:00.000Z'),
      makeItem('bluesky', 'Bluesky', 'Posts', '2026-03-16T08:00:00.000Z'),
    ];

    const days = aggregateByDay(items);

    expect(days).toHaveLength(2);
    // First day: 2026-03-15
    expect(days[0].date).toBe('2026-03-15');
    expect(days[0].total).toBe(3);
    expect(days[0].apps).toHaveLength(2);
    // Bluesky has 2, tangled has 1 -- sorted desc by count
    expect(days[0].apps[0]).toEqual({ appId: 'bluesky', count: 2 });
    expect(days[0].apps[1]).toEqual({ appId: 'tangled', count: 1 });

    // Second day: 2026-03-16
    expect(days[1].date).toBe('2026-03-16');
    expect(days[1].total).toBe(1);
    expect(days[1].apps).toEqual([{ appId: 'bluesky', count: 1 }]);
  });

  it('sorts apps by count desc within each day', () => {
    const items = [
      makeItem('tangled', 'Tangled', 'Code', '2026-03-15T10:00:00.000Z'),
      makeItem('tangled', 'Tangled', 'Code', '2026-03-15T11:00:00.000Z'),
      makeItem('tangled', 'Tangled', 'Code', '2026-03-15T12:00:00.000Z'),
      makeItem('bluesky', 'Bluesky', 'Posts', '2026-03-15T13:00:00.000Z'),
    ];

    const days = aggregateByDay(items);
    expect(days[0].apps[0].appId).toBe('tangled');
    expect(days[0].apps[0].count).toBe(3);
    expect(days[0].apps[1].appId).toBe('bluesky');
    expect(days[0].apps[1].count).toBe(1);
  });

  it('sorts days ascending by date', () => {
    const items = [
      makeItem('bluesky', 'Bluesky', 'Posts', '2026-03-20T10:00:00.000Z'),
      makeItem('bluesky', 'Bluesky', 'Posts', '2026-03-18T10:00:00.000Z'),
      makeItem('bluesky', 'Bluesky', 'Posts', '2026-03-19T10:00:00.000Z'),
    ];

    const days = aggregateByDay(items);
    expect(days.map((d) => d.date)).toEqual(['2026-03-18', '2026-03-19', '2026-03-20']);
  });
});
