import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  customerAccountInvalidationTargets,
  invalidateCustomerAccountQueries,
} from './customer-account-invalidation';

const serviceInvalidate = vi.fn();

vi.mock('@/data/adminDataClient', () => ({
  getAdminDataClient: () => ({
    service: { invalidate: serviceInvalidate },
  }),
}));

describe('customerAccountInvalidationTargets', () => {
  it('includes customers, documents, receivables and accounting money surfaces', () => {
    const targets = customerAccountInvalidationTargets('shop-42');

    expect(targets.customersEntity).toBe('customers');
    expect(targets.customersEntityKey).toEqual(['groaurum', 'customers']);
    expect(targets.customerDetailKey).toEqual([
      'groaurum',
      'customers',
      'detail',
      'shop-42',
    ]);
    expect(targets.documentsKey).toEqual([
      'groaurum',
      'customers',
      'documents',
      'shop-42',
    ]);
    expect(targets.receivablesSnapshotKey).toEqual([
      'groaurum',
      'receivables',
      'snapshot',
    ]);
    expect(targets.accountingKey).toEqual(['groaurum', 'accounting']);
    expect(targets.dayBookKey).toEqual(['groaurum', 'day-book']);
    expect(targets.financialKey).toEqual(['groaurum', 'financial']);
  });
});

describe('invalidateCustomerAccountQueries', () => {
  beforeEach(() => {
    serviceInvalidate.mockClear();
  });

  it('invalidates customer, receivables and accounting-related query prefixes', async () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await invalidateCustomerAccountQueries(queryClient, 'shop-42');

    expect(serviceInvalidate).toHaveBeenCalledWith('customers');
    const keys = spy.mock.calls.map((call) => call[0]?.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        ['groaurum', 'customers'],
        ['groaurum', 'customers', 'detail', 'shop-42'],
        ['groaurum', 'customers', 'documents', 'shop-42'],
        ['groaurum', 'receivables', 'snapshot'],
        ['groaurum', 'accounting'],
        ['groaurum', 'day-book'],
        ['groaurum', 'financial'],
      ]),
    );
  });
});
