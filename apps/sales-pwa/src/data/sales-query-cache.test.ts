import { describe, expect, it } from 'vitest';
import {
  hydrateUpdatedAtForQueryKey,
  isVolatileSalesQueryKey,
  shouldPersistSalesQuery,
} from './sales-query-cache';

describe('sales query cache catalogue sync', () => {
  it('treats orderable-skus as volatile so Admin price/product changes refetch', () => {
    expect(isVolatileSalesQueryKey(['sales', 'orderable-skus'])).toBe(true);
    expect(shouldPersistSalesQuery(['sales', 'orderable-skus'])).toBe(false);
    expect(hydrateUpdatedAtForQueryKey(['sales', 'orderable-skus'])).toBe(0);
  });

  it('treats order-preview as volatile so server prices stay current', () => {
    expect(isVolatileSalesQueryKey(['sales', 'order-preview', 'a:1'])).toBe(true);
    expect(shouldPersistSalesQuery(['sales', 'order-preview', 'a:1'])).toBe(false);
    expect(hydrateUpdatedAtForQueryKey(['sales', 'order-preview', 'a:1'])).toBe(0);
  });

  it('still persists durable salesman queries (retailers, dashboard, profile)', () => {
    expect(shouldPersistSalesQuery(['sales', 'retailers'])).toBe(true);
    expect(shouldPersistSalesQuery(['sales', 'dashboard'])).toBe(true);
    expect(shouldPersistSalesQuery(['sales', 'profile', 'u1'])).toBe(true);
    expect(hydrateUpdatedAtForQueryKey(['sales', 'retailers'])).toBeUndefined();
  });
});
