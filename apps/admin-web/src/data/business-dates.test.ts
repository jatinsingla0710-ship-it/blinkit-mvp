import { describe, expect, it } from 'vitest';
import {
  businessDateRangeInclusive,
  businessDayEndExclusiveIso,
  businessDayEndInclusiveIso,
  businessDayStartIso,
  ymdInBusinessTz,
} from './business-dates';

describe('business dates (Asia/Kolkata)', () => {
  it('uses IST midnight start for a calendar day', () => {
    expect(businessDayStartIso('2026-10-01')).toBe('2026-10-01T00:00:00+05:30');
  });

  it('uses exclusive end at next IST midnight', () => {
    expect(businessDayEndExclusiveIso('2026-10-01')).toBe(
      '2026-10-02T00:00:00+05:30',
    );
  });

  it('uses inclusive end matching Day Book style', () => {
    expect(businessDayEndInclusiveIso('2026-10-01')).toBe(
      '2026-10-01T23:59:59.999+05:30',
    );
  });

  it('keeps start inclusive and end exclusive for a single day', () => {
    const range = businessDateRangeInclusive('2026-10-01', '2026-10-01');
    expect(range.fromIso).toBe('2026-10-01T00:00:00+05:30');
    expect(range.toIsoExclusive).toBe('2026-10-02T00:00:00+05:30');
    expect(range.toIsoInclusive).toBe('2026-10-01T23:59:59.999+05:30');
  });

  it('maps UTC instants near IST midnight to the correct business day', () => {
    // 2026-09-30 19:30 UTC = 2026-10-01 01:00 IST
    expect(ymdInBusinessTz('2026-09-30T19:30:00.000Z')).toBe('2026-10-01');
    // 2026-09-30 18:29 UTC = 2026-09-30 23:59 IST
    expect(ymdInBusinessTz('2026-09-30T18:29:00.000Z')).toBe('2026-09-30');
  });
});
