import { describe, expect, it } from 'vitest';
import {
  daysBetween,
  receivableAgeingBucket,
  summarizeAgeingOutstanding,
} from './customer-ageing';

describe('Phase 10 customer ageing', () => {
  it('computes calendar days between dates', () => {
    expect(daysBetween('2026-10-01T00:00:00.000Z', '2026-10-11T00:00:00.000Z')).toBe(
      10,
    );
  });

  it('maps open days to buckets', () => {
    expect(receivableAgeingBucket(null, 100)).toBe('none');
    expect(receivableAgeingBucket(0, 100)).toBe('current');
    expect(receivableAgeingBucket(15, 100)).toBe('days_1_30');
    expect(receivableAgeingBucket(45, 100)).toBe('days_31_60');
    expect(receivableAgeingBucket(90, 100)).toBe('days_61_plus');
    expect(receivableAgeingBucket(90, 0)).toBe('none');
  });

  it('summarizes outstanding by bucket', () => {
    const totals = summarizeAgeingOutstanding([
      { outstanding: 100, ageingBucket: 'days_1_30' },
      { outstanding: 200, ageingBucket: 'days_61_plus' },
      { outstanding: 50, ageingBucket: 'none' },
    ]);
    expect(totals.days_1_30).toBe(100);
    expect(totals.days_61_plus).toBe(200);
    expect(totals.current).toBe(0);
  });
});
