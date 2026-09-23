import { describe, expect, it } from 'vitest';
import {
  countOrdersInCalendarMonth,
  countOrdersThisMonthBySalesman,
  mapSalesVisitStatus,
  sumOrderRevenueInCalendarMonth,
  latestOrderAtByShop,
} from './salesmen-helpers';

function localIso(year: number, monthIndex: number, day: number): string {
  return new Date(year, monthIndex, day, 12, 0, 0, 0).toISOString();
}

describe('Salesman H1 month KPI helpers', () => {
  const now = new Date(2026, 7, 22, 12, 0, 0, 0); // 22 Aug 2026 local noon

  it('counts only orders in the current calendar month', () => {
    expect(
      countOrdersInCalendarMonth(
        [
          { created_at: localIso(2026, 7, 1) },
          { created_at: localIso(2026, 7, 21) },
          { created_at: localIso(2026, 6, 15) },
          { created_at: localIso(2026, 8, 1) },
        ],
        now,
      ),
    ).toBe(2);

    expect(
      countOrdersInCalendarMonth([{ created_at: localIso(2026, 7, 15) }], now),
    ).toBe(1);
    expect(
      countOrdersInCalendarMonth([{ created_at: localIso(2026, 5, 15) }], now),
    ).toBe(0);
  });

  it('groups month counts by salesman id', () => {
    const map = countOrdersThisMonthBySalesman(
      [
        {
          created_by_profile_id: 'sm-a',
          created_at: localIso(2026, 7, 10),
        },
        {
          created_by_profile_id: 'sm-a',
          created_at: localIso(2026, 7, 12),
        },
        {
          created_by_profile_id: 'sm-b',
          created_at: localIso(2026, 7, 12),
        },
        {
          created_by_profile_id: 'sm-a',
          created_at: localIso(2026, 6, 12),
        },
      ],
      now,
    );
    expect(map.get('sm-a')).toBe(2);
    expect(map.get('sm-b')).toBe(1);
  });

  it('sums revenue only in the current calendar month', () => {
    expect(
      sumOrderRevenueInCalendarMonth(
        [
          { created_at: localIso(2026, 7, 1), total: 200 },
          { created_at: localIso(2026, 6, 1), total: 500 },
        ],
        now,
      ),
    ).toBe(200);
  });

  it('maps latest order timestamp per shop for assigned-customer honesty', () => {
    const map = latestOrderAtByShop([
      { shop_id: 's1', created_at: localIso(2026, 7, 1) },
      { shop_id: 's1', created_at: localIso(2026, 7, 20) },
    ]);
    expect(map.get('s1')).toBe(localIso(2026, 7, 20));
  });
});

describe('Salesman H1 visit status mapping', () => {
  it('maps DB visit statuses to admin UI statuses', () => {
    expect(mapSalesVisitStatus('VISITED')).toBe('completed');
    expect(mapSalesVisitStatus('MISSED')).toBe('missed');
    expect(mapSalesVisitStatus('PLANNED')).toBe('planned');
    expect(mapSalesVisitStatus('PENDING')).toBe('planned');
  });
});
