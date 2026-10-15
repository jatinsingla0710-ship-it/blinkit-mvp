import { invalidation, queryKeys } from '@groaurum/data';
import type { QueryClient } from '@tanstack/react-query';
import { getAdminDataClient } from '@/data/adminDataClient';

/**
 * Query targets refreshed after receive-payment or opening-balance succeeds.
 * Kept pure so mutation invalidation stays testable without a live adapter.
 */
export function customerAccountInvalidationTargets(shopId: string) {
  return {
    customersEntity: 'customers' as const,
    customersEntityKey: invalidation.entity('customers'),
    customerDetailKey: queryKeys.detail('customers', shopId),
    documentsKey: ['groaurum', 'customers', 'documents', shopId] as const,
    receivablesSnapshotKey: ['groaurum', 'receivables', 'snapshot'] as const,
    /** Journals created by customer_collection / customer_opening. */
    accountingKey: ['groaurum', 'accounting'] as const,
    dayBookKey: ['groaurum', 'day-book'] as const,
    financialKey: ['groaurum', 'financial'] as const,
  };
}

/** Invalidate customer account + money surfaces after collection / opening balance. */
export async function invalidateCustomerAccountQueries(
  queryClient: QueryClient,
  shopId: string,
) {
  const targets = customerAccountInvalidationTargets(shopId);
  const client = getAdminDataClient();
  client.service.invalidate(targets.customersEntity);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: targets.customersEntityKey }),
    queryClient.invalidateQueries({ queryKey: targets.customerDetailKey }),
    queryClient.invalidateQueries({ queryKey: targets.documentsKey }),
    queryClient.invalidateQueries({
      queryKey: targets.receivablesSnapshotKey,
    }),
    queryClient.invalidateQueries({ queryKey: targets.accountingKey }),
    queryClient.invalidateQueries({ queryKey: targets.dayBookKey }),
    queryClient.invalidateQueries({ queryKey: targets.financialKey }),
  ]);
}
