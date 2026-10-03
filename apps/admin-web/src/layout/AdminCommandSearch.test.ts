import { describe, expect, it } from 'vitest';
import { SIDEBAR_NAV_GROUPS } from '@/data/nav';
import { filterCommandRoutes } from './AdminCommandSearch';

describe('RichlyBook command search', () => {
  it('requires a useful query and matches owner-facing labels', () => {
    expect(filterCommandRoutes(SIDEBAR_NAV_GROUPS, 'm')).toEqual([]);
    expect(
      filterCommandRoutes(SIDEBAR_NAV_GROUPS, 'money').map((item) => item.id),
    ).toEqual([
      'collections',
      'receivables',
      'payables',
      'dues',
      'purchases',
      'purchase-recommend',
      'expenses',
      'day-book',
      'cash-bank',
      'accounting-books',
    ]);
  });

  it('returns navigable matches without exposing hidden secondary routes', () => {
    expect(
      filterCommandRoutes(SIDEBAR_NAV_GROUPS, 'product').map((item) => item.path),
    ).toEqual(['/products']);
    expect(
      filterCommandRoutes(SIDEBAR_NAV_GROUPS, 'warehouse').map(
        (item) => item.path,
      ),
    ).toEqual([]);
  });
});
