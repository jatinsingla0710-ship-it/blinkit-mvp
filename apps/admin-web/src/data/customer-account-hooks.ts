import { useQuery } from '@tanstack/react-query';
import { toQueryState } from '@groaurum/data';
import { requireLiveAdminApi } from '@/data/adminDataClient';
import { customerAccountInvalidationTargets } from '@/data/customer-account-invalidation';

/** Phase 4D — private customer bill photos (signed URLs). */
export function useCustomerDocumentsQuery(shopId: string | undefined) {
  const documentsKey = customerAccountInvalidationTargets(shopId ?? '')
    .documentsKey;
  const query = useQuery({
    queryKey: documentsKey,
    enabled: Boolean(shopId),
    queryFn: () => requireLiveAdminApi().listCustomerDocuments(shopId!),
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? [],
      isEmpty: (data) => !data || data.length === 0,
    }),
  };
}
