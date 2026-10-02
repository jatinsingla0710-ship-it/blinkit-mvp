import { useQuery } from '@tanstack/react-query';
import { queryKeys, toQueryState } from '@groaurum/data';
import { useAdminDataClient } from '@/data/AdminDataProviders';
import { requireLiveAdminApi } from '@/data/adminDataClient';
import type { SkuCommissionRowVm } from '@/data/commission-types';
import { inventoryDetailLookupKey } from '@/data/inventory-detail-key';

export function useCategoriesListQuery() {
  const { repositories } = useAdminDataClient();
  const query = useQuery({
    queryKey: queryKeys.list('categories'),
    queryFn: ({ signal }) => repositories.categories.list({ signal }),
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => !data || data.length === 0,
    }),
  };
}

export function useProductsListQuery() {
  const { repositories } = useAdminDataClient();
  const query = useQuery({
    queryKey: queryKeys.list('products'),
    queryFn: ({ signal }) => repositories.products.list({ signal }),
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
    }),
  };
}

export function useProductDetailQuery(productId: string | undefined) {
  const { repositories } = useAdminDataClient();
  const query = useQuery({
    queryKey: queryKeys.detail('products', productId ?? ''),
    enabled: Boolean(productId),
    queryFn: ({ signal }) =>
      repositories.products.getById(productId!, { signal }),
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data === null,
    }),
  };
}

export function useProductDeletionInfoQuery(
  productId: string | undefined,
  enabled = false,
) {
  const query = useQuery({
    queryKey: ['groaurum', 'products', 'deletion-info', productId ?? ''],
    enabled: Boolean(productId) && enabled,
    queryFn: () => requireLiveAdminApi().productDeletionInfo(productId!),
  });
  return query;
}

export function usePricesListQuery() {
  const { repositories } = useAdminDataClient();
  const query = useQuery({
    queryKey: queryKeys.list('prices'),
    queryFn: ({ signal }) => repositories.prices.list({ signal }),
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
    }),
  };
}

export function useSkuCommissionListQuery() {
  const query = useQuery({
    queryKey: ['groaurum', 'commission', 'sku-terms'],
    queryFn: () => requireLiveAdminApi().listSkuCommissionRows(),
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: (query.data ?? null) as SkuCommissionRowVm[] | null,
      isEmpty: () => false,
    }),
  };
}

export function usePriceDetailQuery(skuId: string | undefined) {
  const { repositories } = useAdminDataClient();
  const query = useQuery({
    queryKey: queryKeys.detail('prices', skuId ?? ''),
    enabled: Boolean(skuId),
    queryFn: ({ signal }) => repositories.prices.getById(skuId!, { signal }),
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data === null,
    }),
  };
}

export function useInventorySnapshotQuery() {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: queryKeys.snapshot('inventory'),
    queryFn: () => client.getSnapshot('inventory'),
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => !data || data.rows.length === 0,
    }),
  };
}

export function useInventoryDetailQuery(
  skuId: string | undefined,
  balanceId?: string | null,
) {
  const { repositories } = useAdminDataClient();
  const lookupKey = inventoryDetailLookupKey(skuId ?? '', balanceId);
  const query = useQuery({
    queryKey: queryKeys.detail('inventory', lookupKey),
    enabled: Boolean(skuId),
    queryFn: ({ signal }) =>
      repositories.inventory.getById(lookupKey, { signal }),
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data === null,
    }),
  };
}

export function useCustomersSnapshotQuery() {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: queryKeys.snapshot('customers'),
    queryFn: () => client.getSnapshot('customers'),
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => !data || data.rows.length === 0,
    }),
  };
}

export function useCustomerDetailQuery(customerId: string | undefined) {
  const { repositories } = useAdminDataClient();
  const query = useQuery({
    queryKey: queryKeys.detail('customers', customerId ?? ''),
    enabled: Boolean(customerId),
    queryFn: ({ signal }) =>
      repositories.customers.getById(customerId!, { signal }),
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data === null,
    }),
  };
}

export function useOrdersSnapshotQuery() {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: queryKeys.snapshot('orders'),
    queryFn: () => client.getSnapshot('orders'),
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => !data || data.rows.length === 0,
    }),
  };
}

export function useSalesDashboardQuery() {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'sales', 'dashboard'],
    enabled: Boolean(client.liveApi),
    queryFn: () => {
      if (!client.liveApi) throw new Error('Live API required');
      return client.liveApi.salesDashboardMetrics();
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data === null,
    }),
  };
}

export function useSalesRegisterQuery(opts?: {
  fromIso?: string | null;
  toIso?: string | null;
  search?: string;
}) {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'sales', 'register', opts],
    enabled: Boolean(client.liveApi),
    queryFn: () => {
      if (!client.liveApi) throw new Error('Live API required');
      return client.liveApi.listSalesRegister(opts);
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => !data || data.length === 0,
    }),
  };
}

export function useOrderDetailQuery(orderId: string | undefined) {
  const { repositories } = useAdminDataClient();
  const query = useQuery({
    queryKey: queryKeys.detail('orders', orderId ?? ''),
    enabled: Boolean(orderId),
    queryFn: ({ signal }) => repositories.orders.getById(orderId!, { signal }),
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data === null,
    }),
  };
}

export function useOrdersNeedingAttentionQuery(limit = 50) {
  const { liveApi } = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'orders', 'needs-attention', limit],
    enabled: Boolean(liveApi),
    queryFn: () => liveApi!.listOrdersNeedingAttention(limit),
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => !data || data.count === 0,
    }),
  };
}

export function useSalesmenSnapshotQuery() {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: queryKeys.snapshot('salesmen'),
    queryFn: () => client.getSnapshot('salesmen'),
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => !data || data.rows.length === 0,
    }),
  };
}

export function useSalesmanDetailQuery(salesmanId: string | undefined) {
  const { repositories } = useAdminDataClient();
  const query = useQuery({
    queryKey: queryKeys.detail('salesmen', salesmanId ?? ''),
    enabled: Boolean(salesmanId),
    queryFn: ({ signal }) =>
      repositories.salesmen.getById(salesmanId!, { signal }),
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data === null,
    }),
  };
}

export function useDeliverySnapshotQuery() {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: queryKeys.snapshot('delivery'),
    queryFn: () => client.getSnapshot('delivery'),
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => !data || data.rows.length === 0,
    }),
  };
}

export function useDeliveryDetailQuery(routeId: string | undefined) {
  const { repositories } = useAdminDataClient();
  const query = useQuery({
    queryKey: queryKeys.detail('delivery', routeId ?? ''),
    enabled: Boolean(routeId),
    queryFn: ({ signal }) =>
      repositories.delivery.getById(routeId!, { signal }),
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data === null,
    }),
  };
}

export function useReportsSnapshotQuery() {
  const { repositories } = useAdminDataClient();
  const query = useQuery({
    queryKey: queryKeys.snapshot('reports'),
    queryFn: ({ signal }) => repositories.reports.getById('current', { signal }),
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data === null,
    }),
  };
}

export function useSettingsSnapshotQuery() {
  const { repositories } = useAdminDataClient();
  const query = useQuery({
    queryKey: queryKeys.snapshot('settings'),
    queryFn: ({ signal }) =>
      repositories.settings.getById('current', { signal }),
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data === null,
    }),
  };
}

export function useDashboardSnapshotQuery() {
  const { repositories } = useAdminDataClient();
  const query = useQuery({
    queryKey: queryKeys.snapshot('dashboard'),
    queryFn: ({ signal }) =>
      repositories.dashboard.getById('current', { signal }),
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data === null,
    }),
  };
}

export function useServiceAreasListQuery() {
  const { repositories } = useAdminDataClient();
  const query = useQuery({
    queryKey: queryKeys.list('service_areas'),
    queryFn: ({ signal }) => repositories.serviceAreas.list({ signal }),
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data == null,
    }),
  };
}

export function useWarehousesListQuery() {
  const { repositories } = useAdminDataClient();
  const query = useQuery({
    queryKey: queryKeys.list('operational_locations'),
    queryFn: ({ signal }) => repositories.warehouses.list({ signal }),
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data == null,
    }),
  };
}

export function useDeliveryStaffQuery() {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'delivery_staff', 'list'],
    queryFn: async () => {
      if (client.liveApi) {
        return client.liveApi.deliveryStaffList();
      }
      const { DELIVERY_STAFF_FIXTURE } = await import(
        '@/data/delivery-staff-fixtures'
      );
      return DELIVERY_STAFF_FIXTURE;
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data == null,
    }),
  };
}

export function useDeliveryBoysSnapshotQuery() {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'delivery', 'boys'],
    queryFn: () => {
      if (!client.liveApi) throw new Error('Live API required');
      return client.liveApi.getDeliveryBoysSnapshot();
    },
    enabled: Boolean(client.liveApi),
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => !data || data.rows.length === 0,
    }),
  };
}

export function useDeliveryBoyDetailQuery(boyId: string | undefined) {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'delivery', 'boys', 'detail', boyId ?? ''],
    enabled: Boolean(boyId && client.liveApi),
    queryFn: () => {
      if (!client.liveApi || !boyId) throw new Error('Live API required');
      return client.liveApi.getDeliveryBoyDetail(boyId);
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data === null,
    }),
  };
}

export function useVehiclesListQuery() {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'delivery', 'vehicles'],
    enabled: Boolean(client.liveApi),
    queryFn: () => {
      if (!client.liveApi) throw new Error('Live API required');
      return client.liveApi.listVehicles();
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => !data || data.length === 0,
    }),
  };
}

export function useDeliveryOpsDashboardQuery() {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'delivery', 'ops'],
    enabled: Boolean(client.liveApi),
    queryFn: () => {
      if (!client.liveApi) throw new Error('Live API required');
      return client.liveApi.getDeliveryOpsDashboard();
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data == null,
    }),
  };
}

export function useReadyForDeliveryOrdersQuery() {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'delivery', 'ready-queue'],
    enabled: Boolean(client.liveApi),
    queryFn: () => {
      if (!client.liveApi) throw new Error('Live API required');
      return client.liveApi.listReadyForDeliveryOrders();
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => !data || data.length === 0,
    }),
  };
}

export function useDeliveryExceptionsQuery(openOnly = true) {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'delivery', 'exceptions', openOnly],
    enabled: Boolean(client.liveApi),
    queryFn: () => {
      if (!client.liveApi) throw new Error('Live API required');
      return client.liveApi.listDeliveryExceptions({ openOnly });
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => !data || data.length === 0,
    }),
  };
}

export function useDeliveryTimeSlotsQuery() {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'delivery', 'time-slots'],
    enabled: Boolean(client.liveApi),
    queryFn: () => {
      if (!client.liveApi) throw new Error('Live API required');
      return client.liveApi.listDeliveryTimeSlots();
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => !data || data.length === 0,
    }),
  };
}

export function useCodCustodySummariesQuery() {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'delivery', 'cod-custody'],
    enabled: Boolean(client.liveApi),
    queryFn: () => {
      if (!client.liveApi) throw new Error('Live API required');
      return client.liveApi.listCodCustodySummaries();
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => !data || data.length === 0,
    }),
  };
}

export function useCodCustodyCollectionsQuery(
  status: 'WITH_DRIVER' | 'RECEIVED_BY_MANAGER' | 'RECEIVED_BY_OWNER',
  enabled = true,
) {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'delivery', 'cod-custody', 'collections', status],
    enabled: enabled && Boolean(client.liveApi),
    queryFn: () => {
      if (!client.liveApi) throw new Error('Live API required');
      return client.liveApi.listCodCustodyCollections({ status });
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => !data || data.length === 0,
    }),
  };
}

export function useManagerCodCustodyBreakdownQuery(enabled = true) {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'payments', 'manager-cod-breakdown'],
    enabled: enabled && Boolean(client.liveApi),
    queryFn: () => {
      if (!client.liveApi) throw new Error('Live API required');
      return client.liveApi.listManagerCodCustodyBreakdown();
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => !data || data.rows.length === 0,
    }),
  };
}

export function useSalesmenWorkingTodayQuery(enabled = true) {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'dashboard', 'salesmen-working-today'],
    enabled: Boolean(enabled && client.liveApi),
    queryFn: () => {
      if (!client.liveApi) throw new Error('Live API required');
      return client.liveApi.listSalesmenWorkingToday();
    },
  });
  return query;
}

export function usePaymentsOverviewQuery() {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'payments', 'overview'],
    enabled: Boolean(client.liveApi),
    queryFn: () => {
      if (!client.liveApi) throw new Error('Live API required');
      return client.liveApi.paymentsOverview();
    },
  });
  return query;
}

export function usePaymentsListQuery(opts?: {
  onlineOnly?: boolean;
  cashOnly?: boolean;
  ofdUnpaidOnly?: boolean;
}) {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: [
      'groaurum',
      'payments',
      'list',
      opts?.onlineOnly ? 'online' : opts?.cashOnly ? 'cash' : 'all',
      opts?.ofdUnpaidOnly ? 'ofd_unpaid' : 'any',
    ],
    enabled: Boolean(client.liveApi),
    queryFn: () => {
      if (!client.liveApi) throw new Error('Live API required');
      return client.liveApi.listPayments(opts);
    },
  });
  return query;
}

export function useReceivablesSnapshotQuery() {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'receivables', 'snapshot'],
    enabled: Boolean(client.liveApi),
    queryFn: () => {
      if (!client.liveApi) throw new Error('Live API required');
      return client.liveApi.receivablesSnapshot();
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => !data || data.rows.length === 0,
    }),
  };
}

export function useCompanyExpensesSnapshotQuery() {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'company-expenses', 'snapshot'],
    enabled: Boolean(client.liveApi),
    queryFn: () => {
      if (!client.liveApi) throw new Error('Live API required');
      return client.liveApi.companyExpensesSnapshot();
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      // Allow empty list + Add expense CTA on first visit.
      isEmpty: (data) => data == null,
    }),
  };
}

export function useCompanyExpenseDetailQuery(expenseId: string | undefined) {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'company-expenses', 'detail', expenseId ?? ''],
    enabled: Boolean(expenseId && client.liveApi),
    queryFn: () => {
      if (!client.liveApi || !expenseId) throw new Error('Live API required');
      return client.liveApi.companyExpenseDetail(expenseId);
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data === null,
    }),
  };
}

export function usePayrollMonthSnapshotQuery(month: string) {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'payroll', 'month', month],
    enabled: Boolean(client.liveApi && month),
    queryFn: () => {
      if (!client.liveApi) throw new Error('Live API required');
      return client.liveApi.payrollMonthSnapshot(month);
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      // Keep month selector visible when no rows yet.
      isEmpty: (data) => data == null,
    }),
  };
}

export function useSalesmanPayrollQuery(salesmanId: string | undefined) {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'payroll', 'salesman', salesmanId ?? ''],
    enabled: Boolean(salesmanId && client.liveApi),
    queryFn: () => {
      if (!client.liveApi || !salesmanId) throw new Error('Live API required');
      return client.liveApi.listSalesmanPayroll(salesmanId);
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data == null,
    }),
  };
}

export function useDayBookSnapshotQuery(opts: {
  dateFrom: string;
  dateTo: string;
  type?: 'all' | 'sale' | 'collection' | 'expense' | 'refund' | 'payroll';
  paymentMethod?: string;
}) {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: [
      'groaurum',
      'day-book',
      opts.dateFrom,
      opts.dateTo,
      opts.type ?? 'all',
      opts.paymentMethod ?? 'all',
    ],
    enabled: Boolean(client.liveApi && opts.dateFrom && opts.dateTo),
    queryFn: () => {
      if (!client.liveApi) throw new Error('Live API required');
      return client.liveApi.dayBookSnapshot(opts);
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      // Keep filters visible even when the range has no rows.
      isEmpty: (data) => data == null,
    }),
  };
}

export function useOwnerFinancialOverviewQuery() {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'financial', 'owner-overview'],
    enabled: Boolean(client.liveApi),
    queryFn: () => {
      if (!client.liveApi) throw new Error('Live API required');
      return client.liveApi.ownerFinancialOverview();
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data == null,
    }),
  };
}

export function useProfitLossQuery(opts: { dateFrom: string; dateTo: string }) {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'financial', 'profit-loss', opts.dateFrom, opts.dateTo],
    enabled: Boolean(client.liveApi && opts.dateFrom && opts.dateTo),
    queryFn: () => {
      if (!client.liveApi) throw new Error('Live API required');
      return client.liveApi.profitLossSnapshot(opts);
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data == null,
    }),
  };
}

export function useProductSalesReportQuery(opts: {
  dateFrom: string | null;
  dateTo: string | null;
}) {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: [
      'groaurum',
      'financial',
      'product-sales',
      opts.dateFrom ?? 'all',
      opts.dateTo ?? 'all',
    ],
    enabled: Boolean(client.liveApi),
    queryFn: () => {
      if (!client.liveApi) throw new Error('Live API required');
      return client.liveApi.productSalesReport(opts);
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data == null,
    }),
  };
}

export function useOrderDeliveryExtrasQuery(orderId: string | undefined) {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'orders', 'delivery-extras', orderId ?? ''],
    enabled: Boolean(orderId && client.liveApi),
    queryFn: async () => {
      if (!client.liveApi || !orderId) throw new Error('Live API required');
      const [schedule, notifications] = await Promise.all([
        client.liveApi.listOrderScheduleEvents(orderId),
        client.liveApi.listOrderNotificationEvents(orderId),
      ]);
      return { schedule, notifications };
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data == null,
    }),
  };
}

export function useSuppliersListQuery() {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'suppliers', 'list'],
    enabled: Boolean(client.liveApi),
    queryFn: () => {
      if (!client.liveApi) throw new Error('Live API required');
      return client.liveApi.suppliersList();
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data == null,
    }),
  };
}

export function useSupplierDetailQuery(supplierId: string | undefined) {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'suppliers', 'detail', supplierId ?? ''],
    enabled: Boolean(supplierId && client.liveApi),
    queryFn: () => {
      if (!client.liveApi || !supplierId) throw new Error('Live API required');
      return client.liveApi.supplierDetail(supplierId);
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data == null,
    }),
  };
}

export function usePurchasesListQuery() {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'purchases', 'list'],
    enabled: Boolean(client.liveApi),
    queryFn: () => {
      if (!client.liveApi) throw new Error('Live API required');
      return client.liveApi.purchasesList();
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data == null,
    }),
  };
}

export function usePurchaseDetailQuery(purchaseId: string | undefined) {
  const client = useAdminDataClient();
  const query = useQuery({
    queryKey: ['groaurum', 'purchases', 'detail', purchaseId ?? ''],
    enabled: Boolean(purchaseId && client.liveApi),
    queryFn: () => {
      if (!client.liveApi || !purchaseId) throw new Error('Live API required');
      return client.liveApi.purchaseDetail(purchaseId);
    },
  });
  return {
    ...query,
    state: toQueryState({
      isPending: query.isPending,
      isError: query.isError,
      error: query.error,
      data: query.data ?? null,
      isEmpty: (data) => data == null,
    }),
  };
}
