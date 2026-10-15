import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  customerAccountInvalidationTargets,
  invalidateCustomerAccountQueries,
} from '@/data/customer-account-invalidation';
import { requireCrudServices, requireLiveAdminApi } from '@/data/adminDataClient';

/** Phase 4D — customer-level receive payment. */
export function useRecordCustomerCollectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'customers', 'recordCollection'],
    mutationFn: (vars: {
      shopId: string;
      amount: number;
      method: string;
      note?: string | null;
      clientRequestId?: string | null;
    }) => requireLiveAdminApi().recordCustomerCollection(vars),
    onSuccess: async (_data, vars) => {
      await invalidateCustomerAccountQueries(queryClient, vars.shopId);
    },
  });
}

/** Phase 4D — set / replace customer opening balance. */
export function useSetShopOpeningBalanceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'customers', 'setOpeningBalance'],
    mutationFn: (vars: {
      shopId: string;
      asOfDate: string;
      amount: number;
      note?: string | null;
    }) => requireLiveAdminApi().setShopOpeningBalance(vars),
    onSuccess: async (_data, vars) => {
      await invalidateCustomerAccountQueries(queryClient, vars.shopId);
    },
  });
}

export function useCreateCustomerDocumentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'customers', 'document', 'create'],
    mutationFn: (vars: {
      shopId: string;
      documentType?: 'BILL_PHOTO' | 'GST' | 'OTHER';
      title?: string | null;
      notes?: string | null;
      billDate?: string | null;
      billNumber?: string | null;
    }) => requireLiveAdminApi().createCustomerDocument(vars),
    onSuccess: async (_data, vars) => {
      const { documentsKey } = customerAccountInvalidationTargets(vars.shopId);
      await queryClient.invalidateQueries({ queryKey: documentsKey });
    },
  });
}

export function useUploadCustomerDocumentImageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'customers', 'document', 'upload'],
    mutationFn: (vars: {
      shopId: string;
      documentId: string;
      file: { bytes: Blob | ArrayBuffer | Uint8Array; contentType: string };
    }) =>
      requireLiveAdminApi().uploadCustomerDocumentImage(
        vars.documentId,
        vars.file,
      ),
    onSuccess: async (_data, vars) => {
      const { documentsKey } = customerAccountInvalidationTargets(vars.shopId);
      await queryClient.invalidateQueries({ queryKey: documentsKey });
    },
  });
}

export function useSoftDeleteCustomerDocumentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'customers', 'document', 'softDelete'],
    mutationFn: (vars: { shopId: string; documentId: string }) =>
      requireLiveAdminApi().softDeleteCustomerDocument(vars.documentId),
    onSuccess: async (_data, vars) => {
      const { documentsKey } = customerAccountInvalidationTargets(vars.shopId);
      await queryClient.invalidateQueries({ queryKey: documentsKey });
    },
  });
}

/** Archive customer (soft-delete). Keeps accounting history. */
export function useArchiveCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'customers', 'archive'],
    mutationFn: (shopId: string) =>
      requireCrudServices().softDeleteCustomer(shopId),
    onSuccess: async (_data, shopId) => {
      await invalidateCustomerAccountQueries(queryClient, shopId);
    },
  });
}
