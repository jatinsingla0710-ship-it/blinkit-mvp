import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { invalidation, queryKeys, type EntityName } from '@groaurum/data';
import type {
  CategoryCreateInput,
  CategoryUpdateInput,
  CustomerCreateInput,
  CustomerContactUpdateInput,
  CustomerUpdateInput,
  DeliveryRouteCreateInput,
  DeliveryRouteUpdateInput,
  InventoryAdjustInput,
  OrderCreateInput,
  PriceCreateInput,
  ProductCreateInput,
  ProductUpdateInput,
  SalesmanCreateInput,
  ServiceAreaCreateInput,
  ServiceAreaUpdateInput,
  ServiceabilityRuleCreateInput,
  ServiceabilityRuleUpdateInput,
  SettingUpsertInput,
  SkuCreateInput,
  SkuUpdateInput,
  WarehouseCreateInput,
  WarehouseUpdateInput,
} from '@groaurum/validation';
import { requireCrudServices, getAdminDataClient, requireLiveAdminApi } from '@/data/adminDataClient';
import type { LiveAdminApi } from '@/data/live/LiveAdminApi';
import type { OrderDetail } from '@/data/orders-types';
import { formatDateTime, formatInr } from '@/data/live/format';

type OrderStatus =
  | 'DRAFT_ASSISTED'
  | 'AWAITING_CUSTOMER_CONFIRMATION'
  | 'CONFIRMED'
  | 'STOCK_RESERVED'
  | 'PROCESSING'
  | 'READY_FOR_DISPATCH'
  | 'ASSIGNED_TO_ROUTE'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'DELIVERY_FAILED'
  | 'CANCELLED';

function invalidateEntity(queryClient: QueryClient, entity: EntityName) {
  const client = getAdminDataClient();
  client.service.invalidate(entity);
  return queryClient.invalidateQueries({ queryKey: invalidation.entity(entity) });
}

/**
 * Optimistic update helpers — apply cache patch, rollback on error, invalidate on settle.
 */
function withOptimisticListPatch<TItem extends { id: string }>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  optimistic: TItem | ((prev: TItem[] | undefined) => TItem[]),
) {
  const previous = queryClient.getQueryData<TItem[]>(queryKey);
  queryClient.setQueryData<TItem[]>(queryKey, (old) => {
    if (typeof optimistic === 'function') {
      return optimistic(old);
    }
    return [...(old ?? []), optimistic];
  });
  return previous;
}

export function useCreateProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'products', 'create'],
    mutationFn: (input: ProductCreateInput) =>
      requireCrudServices().createProduct(input),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: invalidation.entity('products') });
    },
    onSuccess: async () => {
      await invalidateEntity(queryClient, 'products');
      await invalidateEntity(queryClient, 'categories');
    },
  });
}

export function useUpdateProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'products', 'update'],
    mutationFn: (vars: { id: string; input: ProductUpdateInput }) =>
      requireCrudServices().updateProduct(vars.id, vars.input),
    onSuccess: async (_data, vars) => {
      await invalidateEntity(queryClient, 'products');
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'products', 'detail', vars.id],
      });
    },
  });
}

async function invalidateProductDetail(queryClient: ReturnType<typeof useQueryClient>, productId: string) {
  await invalidateEntity(queryClient, 'products');
  await queryClient.invalidateQueries({
    queryKey: ['groaurum', 'products', 'detail', productId],
  });
}

export function useUploadProductMediaMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'products', 'uploadMedia'],
    mutationFn: (input: {
      productId: string;
      file: File;
      mediaKind: 'IMAGE' | 'VIDEO';
      altText?: string;
    }) => requireLiveAdminApi().uploadProductMedia(input),
    onSuccess: async (_data, vars) => {
      await invalidateProductDetail(queryClient, vars.productId);
    },
  });
}

export function useReplaceProductMediaMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'products', 'replaceMedia'],
    mutationFn: (input: {
      productId: string;
      mediaId: string;
      file: File;
      mediaKind: 'IMAGE' | 'VIDEO';
    }) => requireLiveAdminApi().replaceProductMedia(input),
    onSuccess: async (_data, vars) => {
      await invalidateProductDetail(queryClient, vars.productId);
    },
  });
}

export function useSoftDeleteProductMediaMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'products', 'softDeleteMedia'],
    mutationFn: (mediaId: string) =>
      requireLiveAdminApi().softDeleteProductMedia(mediaId),
    onSuccess: async () => {
      await invalidateEntity(queryClient, 'products');
      await queryClient.invalidateQueries({ queryKey: ['groaurum', 'products', 'detail'] });
    },
  });
}

export function useSetSkuOuterDiscountTiersMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'products', 'outerDiscountTiers'],
    mutationFn: (input: {
      skuId: string;
      tiers: Array<{ minOuterQuantity: number; discountPerOuterUnit: number }>;
    }) => requireLiveAdminApi().setSkuOuterDiscountTiers(input),
    onSuccess: async () => {
      await invalidateEntity(queryClient, 'products');
      await queryClient.invalidateQueries({ queryKey: ['groaurum', 'products', 'detail'] });
    },
  });
}

export function useEnsureCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'categories', 'ensure'],
    mutationFn: (name: string) => requireLiveAdminApi().ensureCategory(name),
    onSuccess: async () => {
      await invalidateEntity(queryClient, 'categories');
    },
  });
}

export function useReorderProductImagesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'products', 'reorderImages'],
    mutationFn: (vars: { productId: string; imageIds: string[] }) =>
      requireLiveAdminApi().reorderProductImages(vars.productId, vars.imageIds),
    onSuccess: async (_data, vars) => {
      await invalidateProductDetail(queryClient, vars.productId);
    },
  });
}

export function useSoftDeleteProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'products', 'softDelete'],
    mutationFn: (id: string) => requireCrudServices().softDeleteProduct(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: invalidation.entity('products') });
      const key = ['groaurum', 'products', 'list'] as const;
      const previous = withOptimisticListPatch<{ id: string }>(
        queryClient,
        key,
        (old) => (old ?? []).filter((row) => row.id !== id),
      );
      return { previous, key };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(ctx.key, ctx.previous);
      }
    },
    onSettled: async () => {
      await invalidateEntity(queryClient, 'products');
    },
  });
}

export function useCreateCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'categories', 'create'],
    mutationFn: (input: CategoryCreateInput) =>
      requireCrudServices().createCategory(input),
    onSuccess: async () => invalidateEntity(queryClient, 'categories'),
  });
}

export function useUpdateCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'categories', 'update'],
    mutationFn: (vars: { id: string; input: CategoryUpdateInput }) =>
      requireCrudServices().updateCategory(vars.id, vars.input),
    onSuccess: async () => invalidateEntity(queryClient, 'categories'),
  });
}

export function useSoftDeleteCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'categories', 'softDelete'],
    mutationFn: (id: string) => requireCrudServices().softDeleteCategory(id),
    onSuccess: async () => invalidateEntity(queryClient, 'categories'),
  });
}

export function useCreateSkuMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'skus', 'create'],
    mutationFn: (input: SkuCreateInput) => requireCrudServices().createSku(input),
    onSuccess: async (_data, input) => {
      await invalidateEntity(queryClient, 'skus');
      await invalidateEntity(queryClient, 'products');
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'products', 'detail', input.productId],
      });
    },
  });
}

export function useUpdateSkuMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'skus', 'update'],
    mutationFn: (vars: { id: string; input: SkuUpdateInput; productId?: string }) =>
      requireCrudServices().updateSku(vars.id, vars.input),
    onSuccess: async (_data, vars) => {
      await invalidateEntity(queryClient, 'skus');
      await invalidateEntity(queryClient, 'products');
      if (vars.productId) {
        await queryClient.invalidateQueries({
          queryKey: ['groaurum', 'products', 'detail', vars.productId],
        });
      }
    },
  });
}

export function useSoftDeleteSkuMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'skus', 'softDelete'],
    mutationFn: (vars: { id: string; productId?: string }) =>
      requireCrudServices().softDeleteSku(vars.id),
    onSuccess: async (_data, vars) => {
      await invalidateEntity(queryClient, 'skus');
      await invalidateEntity(queryClient, 'products');
      if (vars.productId) {
        await queryClient.invalidateQueries({
          queryKey: ['groaurum', 'products', 'detail', vars.productId],
        });
      }
    },
  });
}

export function useCreatePriceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'prices', 'create'],
    mutationFn: (input: PriceCreateInput) =>
      requireCrudServices().createPrice(input),
    onSuccess: async () => {
      await invalidateEntity(queryClient, 'prices');
      await invalidateEntity(queryClient, 'products');
    },
  });
}

export function useClosePriceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'prices', 'close'],
    mutationFn: (id: string) => requireCrudServices().closePrice(id),
    onSuccess: async () => {
      await invalidateEntity(queryClient, 'prices');
      await invalidateEntity(queryClient, 'products');
    },
  });
}

export function useUpdateInventoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'inventory', 'update'],
    mutationFn: (vars: { id?: string; input: InventoryAdjustInput }) => {
      const crud = requireCrudServices();
      return vars.id
        ? crud.updateInventoryBalance(vars.id, vars.input)
        : crud.adjustInventory(vars.input);
    },
    onSuccess: async () => invalidateEntity(queryClient, 'inventory'),
  });
}

export function useCreateCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'customers', 'create'],
    mutationFn: (input: CustomerCreateInput) =>
      requireCrudServices().createCustomer(input),
    onSuccess: async () => invalidateEntity(queryClient, 'customers'),
  });
}

export function useUpdateCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'customers', 'update'],
    mutationFn: (vars: { id: string; input: CustomerUpdateInput }) =>
      requireCrudServices().updateCustomer(vars.id, vars.input),
    onSuccess: async (_data, vars) => {
      await invalidateEntity(queryClient, 'customers');
      await queryClient.invalidateQueries({
        queryKey: queryKeys.detail('customers', vars.id),
      });
    },
  });
}

export function useUpdateCustomerContactMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'customers', 'updateContact'],
    mutationFn: (vars: {
      shopId: string;
      input: CustomerContactUpdateInput;
    }) => requireLiveAdminApi().updateCustomerPrimaryContact(vars.shopId, vars.input),
    onSuccess: async (_data, vars) => {
      await invalidateEntity(queryClient, 'customers');
      await queryClient.invalidateQueries({
        queryKey: queryKeys.detail('customers', vars.shopId),
      });
    },
  });
}

export function useCreateOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'orders', 'create'],
    mutationFn: (input: OrderCreateInput) =>
      requireCrudServices().createOrder(input),
    onSuccess: async () => {
      await invalidateEntity(queryClient, 'orders');
      await invalidateEntity(queryClient, 'inventory');
    },
  });
}

export function useUpdateOrderStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'orders', 'status'],
    mutationFn: (vars: { id: string; status: OrderStatus }) =>
      requireCrudServices().updateOrderStatus(vars.id, vars.status),
    onSuccess: async (_data, vars) => {
      await invalidateEntity(queryClient, 'orders');
      await invalidateEntity(queryClient, 'dashboard');
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'orders', 'detail', vars.id],
      });
    },
  });
}

export function useAssignOrderDeliveryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'orders', 'assignDelivery'],
    mutationFn: (vars: { orderId: string; deliveryProfileId: string }) =>
      requireLiveAdminApi().assignOrderDelivery(
        vars.orderId,
        vars.deliveryProfileId,
      ),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.detail('orders', vars.orderId),
      });
      const previous = patchOrderDetail(queryClient, vars.orderId, (o) => {
        const staff = o.availableDeliveryStaff?.find(
          (s) => s.id === vars.deliveryProfileId,
        );
        return {
          ...o,
          dbStatus: 'ASSIGNED_TO_ROUTE',
          fulfillmentStatus: 'ASSIGNED_TO_ROUTE',
          deliveryStatus: 'assigned',
          delivery: {
            ...o.delivery,
            deliveryPersonId: vars.deliveryProfileId,
            deliveryPersonName: staff?.name ?? o.delivery.deliveryPersonName,
            deliveryStatus: 'assigned',
          },
        };
      });
      return { previous };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(
          queryKeys.detail('orders', vars.orderId),
          ctx.previous,
        );
      }
    },
    onSettled: async (_data, _err, vars) => {
      await invalidateOrderWorkflow(queryClient, vars.orderId);
    },
  });
}

function invalidateOrderWorkflow(
  queryClient: ReturnType<typeof useQueryClient>,
  orderId: string,
) {
  return Promise.all([
    invalidateEntity(queryClient, 'orders'),
    invalidateEntity(queryClient, 'delivery'),
    invalidateEntity(queryClient, 'dashboard'),
    queryClient.invalidateQueries({
      queryKey: queryKeys.detail('orders', orderId),
    }),
  ]);
}

function patchOrderDetail(
  queryClient: QueryClient,
  orderId: string,
  patch: (current: OrderDetail) => OrderDetail,
) {
  const key = queryKeys.detail('orders', orderId);
  const previous = queryClient.getQueryData<OrderDetail>(key);
  if (previous) {
    queryClient.setQueryData(key, patch(previous));
  }
  return previous;
}

export function useConfirmOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'orders', 'confirm'],
    mutationFn: (vars: { orderId: string }) =>
      requireLiveAdminApi().confirmOrder(vars.orderId),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.detail('orders', vars.orderId),
      });
      const previous = patchOrderDetail(queryClient, vars.orderId, (o) => ({
        ...o,
        dbStatus: 'CONFIRMED',
        fulfillmentStatus: 'CONFIRMED',
      }));
      return { previous };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(
          queryKeys.detail('orders', vars.orderId),
          ctx.previous,
        );
      }
    },
    onSettled: async (_data, _err, vars) => {
      await invalidateOrderWorkflow(queryClient, vars.orderId);
    },
  });
}

export function useCreateOrderInvoiceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'orders', 'createInvoice'],
    mutationFn: (vars: { orderId: string }) =>
      requireLiveAdminApi().createOrderInvoice(vars.orderId),
    onSuccess: async (result, vars) => {
      patchOrderDetail(queryClient, vars.orderId, (o) => ({
        ...o,
        invoiceNumber: result.invoiceNumber,
        invoiceCreatedAt: result.invoiceCreatedAt,
        invoiceCreatedAtLabel: formatDateTime(result.invoiceCreatedAt),
      }));
      await invalidateOrderWorkflow(queryClient, vars.orderId);
    },
  });
}

export function useProcessOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'orders', 'processOrder'],
    mutationFn: (vars: {
      orderId: string;
      hasInvoice: boolean;
      invoicePrinted: boolean;
      dbStatus: string;
    }) =>
      requireLiveAdminApi().processOrder(vars.orderId, {
        hasInvoice: vars.hasInvoice,
        invoicePrinted: vars.invoicePrinted,
        dbStatus: vars.dbStatus,
      }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.detail('orders', vars.orderId),
      });
      const previous = patchOrderDetail(queryClient, vars.orderId, (o) => ({
        ...o,
        invoicePrinted: true,
        invoiceNumber: o.invoiceNumber ?? 'pending',
        dbStatus: 'PROCESSING',
        fulfillmentStatus: 'PACKING',
      }));
      return { previous };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(
          queryKeys.detail('orders', vars.orderId),
          ctx.previous,
        );
      }
    },
    onSettled: async (_data, _err, vars) => {
      await invalidateOrderWorkflow(queryClient, vars.orderId);
    },
  });
}

export function useStartPackingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'orders', 'startPacking'],
    mutationFn: (vars: { orderId: string }) =>
      requireLiveAdminApi().startPacking(vars.orderId),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.detail('orders', vars.orderId),
      });
      const previous = patchOrderDetail(queryClient, vars.orderId, (o) => ({
        ...o,
        dbStatus: 'PROCESSING',
        fulfillmentStatus: 'PACKING',
      }));
      return { previous };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(
          queryKeys.detail('orders', vars.orderId),
          ctx.previous,
        );
      }
    },
    onSettled: async (_data, _err, vars) => {
      await invalidateOrderWorkflow(queryClient, vars.orderId);
    },
  });
}

export function useRecordInvoicePrintedMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'orders', 'invoicePrinted'],
    mutationFn: (vars: { orderId: string }) =>
      requireLiveAdminApi().recordInvoicePrinted(vars.orderId),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.detail('orders', vars.orderId),
      });
      const previous = patchOrderDetail(queryClient, vars.orderId, (o) => ({
        ...o,
        invoicePrinted: true,
      }));
      return { previous };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(
          queryKeys.detail('orders', vars.orderId),
          ctx.previous,
        );
      }
    },
    onSettled: async (_data, _err, vars) => {
      await invalidateOrderWorkflow(queryClient, vars.orderId);
    },
  });
}

export function useMarkOrderPackedMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'orders', 'markPacked'],
    mutationFn: (vars: { orderId: string }) =>
      requireLiveAdminApi().packOrder(vars.orderId),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.detail('orders', vars.orderId),
      });
      const previous = patchOrderDetail(queryClient, vars.orderId, (o) => ({
        ...o,
        dbStatus: 'READY_FOR_DISPATCH',
        fulfillmentStatus: 'READY_FOR_DISPATCH',
        deliveryStatus: 'not_started',
      }));
      return { previous };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(
          queryKeys.detail('orders', vars.orderId),
          ctx.previous,
        );
      }
    },
    onSettled: async (_data, _err, vars) => {
      await invalidateOrderWorkflow(queryClient, vars.orderId);
    },
  });
}

export function useReplaceOrderLinesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'orders', 'replaceLines'],
    mutationFn: (vars: {
      orderId: string;
      lines: Array<{ skuId: string; quantity: number; unitPrice?: number }>;
    }) => requireLiveAdminApi().replaceOrderLines(vars.orderId, vars.lines),
    onSuccess: async (_data, vars) => {
      await invalidateOrderWorkflow(queryClient, vars.orderId);
    },
  });
}

export function useConfirmOrderDeliveryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'orders', 'confirmDelivery'],
    mutationFn: (vars: {
      orderId: string;
      source?: 'delivery_boy' | 'customer' | 'admin';
    }) =>
      requireLiveAdminApi().confirmOrderDelivery(
        vars.orderId,
        vars.source ?? 'admin',
      ),
    onSuccess: async (_data, vars) => {
      await invalidateOrderWorkflow(queryClient, vars.orderId);
    },
  });
}

export function useMarkOrderOutForDeliveryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'orders', 'outForDelivery'],
    mutationFn: (vars: { orderId: string }) =>
      requireLiveAdminApi().markOrderOutForDelivery(vars.orderId),
    onSuccess: async (_data, vars) => {
      await invalidateOrderWorkflow(queryClient, vars.orderId);
    },
  });
}

export function useMarkOrderPaymentReceivedMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'orders', 'paymentReceived'],
    mutationFn: (vars: {
      orderId: string;
      collectionMethod?:
        | 'CASH_ON_DELIVERY'
        | 'UPI_ON_DELIVERY'
        | 'CARD_ON_DELIVERY'
        | 'ONLINE_GATEWAY'
        | 'OTHER';
    }) =>
      requireLiveAdminApi().markOrderPaymentReceived(
        vars.orderId,
        vars.collectionMethod ?? 'CASH_ON_DELIVERY',
      ),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.detail('orders', vars.orderId),
      });
      const previous = patchOrderDetail(queryClient, vars.orderId, (o) => ({
        ...o,
        paymentStatus: 'PAID',
        payment: {
          ...o.payment,
          status: 'PAID',
          collected: o.payment.total ?? o.payment.collected,
          collectedLabel: o.payment.totalLabel,
          outstanding: 0,
          outstandingLabel: '₹0',
        },
      }));
      return { previous };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(
          queryKeys.detail('orders', vars.orderId),
          ctx.previous,
        );
      }
    },
    onSettled: async (_data, _err, vars) => {
      await invalidateOrderWorkflow(queryClient, vars.orderId);
    },
  });
}

export function useConvertOrderToSaleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'orders', 'convertToSale'],
    mutationFn: (vars: { orderId: string }) =>
      requireLiveAdminApi().convertOrderToSale(vars.orderId),
    onSuccess: async (result, vars) => {
      patchOrderDetail(queryClient, vars.orderId, (o) => ({
        ...o,
        sale: {
          id: result.saleId,
          invoiceNumber: result.invoiceNumber,
          convertedAtLabel: formatDateTime(result.convertedAt),
        },
      }));
      await invalidateOrderWorkflow(queryClient, vars.orderId);
    },
  });
}

export function useCancelOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'orders', 'cancel'],
    mutationFn: (vars: { orderId: string; note?: string | null }) =>
      requireLiveAdminApi().cancelOrder(vars.orderId, vars.note),
    onSuccess: async (_data, vars) => {
      await invalidateOrderWorkflow(queryClient, vars.orderId);
    },
  });
}

export function useReassignShopSalesmanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'customers', 'reassignSalesman'],
    mutationFn: (vars: {
      shopId: string;
      salesmanProfileId: string;
      reason?: string | null;
    }) =>
      requireLiveAdminApi().reassignShopSalesman(
        vars.shopId,
        vars.salesmanProfileId,
        vars.reason,
      ),
    onSuccess: async (_data, vars) => {
      await invalidateEntity(queryClient, 'customers');
      await invalidateEntity(queryClient, 'salesmen');
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'customers', 'detail', vars.shopId],
      });
    },
  });
}

export function useCreateSalesVisitMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'salesmen', 'createVisit'],
    mutationFn: (vars: {
      salesmanProfileId: string;
      shopId: string;
      plannedAt?: string | null;
      notes?: string | null;
    }) => requireLiveAdminApi().createSalesVisit(vars),
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'salesmen', 'detail', vars.salesmanProfileId],
      });
      await invalidateEntity(queryClient, 'salesmen');
    },
  });
}

/** H2/H3: direct profile create without Auth is blocked — use provision edge flow. */
export const CREATE_SALESMAN_BLOCKED_MESSAGE =
  'Create salesman requires Auth provisioning. Use Provision Salesman (edge function) instead of a bare profile insert.';

export async function rejectCreateSalesman(
  _input: SalesmanCreateInput,
): Promise<never> {
  throw new Error(CREATE_SALESMAN_BLOCKED_MESSAGE);
}

/**
 * Not for direct Auth-less profile insert. Prefer useProvisionSalesmanMutation
 * (edge function). Kept for tests / legacy CrudServices paths that already have
 * an authUserId.
 */
export function useCreateSalesmanMutation() {
  return useMutation({
    mutationKey: ['mutation', 'salesmen', 'create'],
    mutationFn: rejectCreateSalesman,
  });
}

export function useProvisionSalesmanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'salesmen', 'provision'],
    mutationFn: (input: {
      displayName: string;
      mobile: string;
      email: string;
      temporaryPassword: string;
      isActive?: boolean;
    }) => requireLiveAdminApi().provisionSalesman(input),
    onSuccess: async () => {
      await invalidateEntity(queryClient, 'salesmen');
    },
  });
}

export function useUpsertSalesmanEmploymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'salesmen', 'employment'],
    mutationFn: (input: Parameters<
      LiveAdminApi['upsertSalesmanEmployment']
    >[0]) => requireLiveAdminApi().upsertSalesmanEmployment(input),
    onSuccess: async (_data, input) => {
      await invalidateEntity(queryClient, 'salesmen');
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'salesmen', 'detail', input.profileId],
      });
    },
  });
}

export function useSetSalesmanSalaryTermsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'salesmen', 'salary'],
    mutationFn: (input: Parameters<LiveAdminApi['setSalesmanSalaryTerms']>[0]) =>
      requireLiveAdminApi().setSalesmanSalaryTerms(input),
    onSuccess: async (_data, input) => {
      await invalidateEntity(queryClient, 'salesmen');
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'salesmen', 'detail', input.profileId],
      });
    },
  });
}

export function useSetSalesmanTargetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'salesmen', 'target'],
    mutationFn: (input: Parameters<LiveAdminApi['setSalesmanTarget']>[0]) =>
      requireLiveAdminApi().setSalesmanTarget(input),
    onSuccess: async (_data, input) => {
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'salesmen', 'target', input.profileId],
      });
    },
  });
}

export function useReviewSalesmanExpenseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'salesmen', 'expense-review'],
    mutationFn: (input: Parameters<LiveAdminApi['reviewSalesmanExpense']>[0]) =>
      requireLiveAdminApi().reviewSalesmanExpense(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'salesmen', 'claims'],
      });
    },
  });
}

export function useReviewReturnRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'salesmen', 'return-review'],
    mutationFn: (input: Parameters<LiveAdminApi['reviewReturnRequest']>[0]) =>
      requireLiveAdminApi().reviewReturnRequest(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'salesmen', 'claims'],
      });
    },
  });
}

export function useSendSalesmanMessageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'salesmen', 'message'],
    mutationFn: (input: { profileId: string; body: string }) =>
      requireLiveAdminApi().sendSalesmanMessage(input.profileId, input.body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'salesmen', 'messages'],
      });
    },
  });
}

export function useSetSalesmanEarningModelMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'salesmen', 'earningModel'],
    mutationFn: (input: Parameters<LiveAdminApi['setSalesmanEarningModel']>[0]) =>
      requireLiveAdminApi().setSalesmanEarningModel(input),
    onSuccess: async (_data, input) => {
      await invalidateEntity(queryClient, 'salesmen');
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'salesmen', 'detail', input.profileId],
      });
    },
  });
}

export function useSetSkuCommissionTermMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'commission', 'skuTerm'],
    mutationFn: (input: Parameters<LiveAdminApi['setSkuCommissionTerm']>[0]) =>
      requireLiveAdminApi().setSkuCommissionTerm(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'commission', 'sku-terms'],
      });
    },
  });
}

export function useSetSalesmanAttendanceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'salesmen', 'attendance'],
    mutationFn: (input: Parameters<LiveAdminApi['setSalesmanAttendance']>[0]) =>
      requireLiveAdminApi().setSalesmanAttendance(input),
    onSuccess: async (_data, input) => {
      await invalidateEntity(queryClient, 'salesmen');
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'salesmen', 'detail', input.profileId],
      });
    },
  });
}

export function useUpdateSalesVisitStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'salesmen', 'updateVisitStatus'],
    mutationFn: (vars: {
      visitId: string;
      status: 'completed' | 'missed';
      salesmanProfileId: string;
    }) =>
      requireLiveAdminApi().updateSalesVisitStatus(vars.visitId, vars.status),
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'salesmen', 'detail', vars.salesmanProfileId],
      });
      await invalidateEntity(queryClient, 'salesmen');
    },
  });
}

export function useRefundConvertedSaleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'orders', 'refundConvertedSale'],
    mutationFn: (vars: {
      orderId: string;
      reason: string;
      restock?: boolean;
    }) =>
      requireLiveAdminApi().refundConvertedSale(
        vars.orderId,
        vars.reason,
        vars.restock ?? false,
      ),
    onSuccess: async (_data, vars) => {
      patchOrderDetail(queryClient, vars.orderId, (o) => ({
        ...o,
        paymentStatus: 'REFUNDED',
        payment: {
          ...o.payment,
          status: 'REFUNDED',
          collected: 0,
          collectedLabel: formatInr(0),
          outstanding: o.payment.total ?? 0,
          outstandingLabel: formatInr(o.payment.total ?? 0),
        },
      }));
      await invalidateOrderWorkflow(queryClient, vars.orderId);
    },
  });
}

export function useCreateDeliveryRouteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'delivery', 'create'],
    mutationFn: (input: DeliveryRouteCreateInput) =>
      requireCrudServices().createDeliveryRoute(input),
    onSuccess: async () => invalidateEntity(queryClient, 'delivery'),
  });
}

export function useUpdateDeliveryRouteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'delivery', 'update'],
    mutationFn: (vars: { id: string; input: DeliveryRouteUpdateInput }) =>
      requireCrudServices().updateDeliveryRoute(vars.id, vars.input),
    onSuccess: async (_data, vars) => {
      await invalidateEntity(queryClient, 'delivery');
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'delivery', 'detail', vars.id],
      });
    },
  });
}

/**
 * Close the selected route via delivery_complete_route (open-stop checks).
 * Never sets COMPLETED through CRUD.
 */
export function useCompleteDeliveryRouteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'delivery', 'complete'],
    mutationFn: (routeId: string) => {
      if (!routeId.trim()) {
        throw new Error('Select a route to close');
      }
      return requireLiveAdminApi().completeDeliveryRoute(routeId);
    },
    onSuccess: async (_data, routeId) => {
      await invalidateEntity(queryClient, 'delivery');
      await queryClient.invalidateQueries({
        queryKey: queryKeys.detail('delivery', routeId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.snapshot('delivery'),
      });
    },
  });
}

function invalidateDeliveryRoute(queryClient: QueryClient, routeId: string) {
  return Promise.all([
    invalidateEntity(queryClient, 'delivery'),
    queryClient.invalidateQueries({
      queryKey: queryKeys.detail('delivery', routeId),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.snapshot('delivery'),
    }),
    queryClient.invalidateQueries({
      queryKey: invalidation.entity('orders'),
    }),
  ]);
}

export function useCompleteDeliveryStopMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'delivery', 'complete-stop'],
    mutationFn: (vars: {
      stopId: string;
      routeId: string;
      notes?: string | null;
      collectCodAmount?: number | null;
    }) =>
      requireLiveAdminApi().completeDeliveryStop(vars.stopId, {
        notes: vars.notes,
        collectCodAmount: vars.collectCodAmount,
      }),
    onSuccess: async (_data, vars) => {
      await invalidateDeliveryRoute(queryClient, vars.routeId);
    },
  });
}

export function useFailDeliveryStopMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'delivery', 'fail-stop'],
    mutationFn: (vars: {
      stopId: string;
      routeId: string;
      failureReason: string;
      notes?: string | null;
    }) =>
      requireLiveAdminApi().failDeliveryStop(
        vars.stopId,
        vars.failureReason,
        vars.notes,
      ),
    onSuccess: async (_data, vars) => {
      await invalidateDeliveryRoute(queryClient, vars.routeId);
    },
  });
}

export function useAssignOrderToRouteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'delivery', 'assign-order'],
    mutationFn: (vars: { orderId: string; routeId: string }) =>
      requireLiveAdminApi().assignOrderToRoute(vars.orderId, vars.routeId),
    onSuccess: async (_data, vars) => {
      await invalidateDeliveryRoute(queryClient, vars.routeId);
    },
  });
}

export function useStartDeliveryRouteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'delivery', 'start-route'],
    mutationFn: (routeId: string) =>
      requireLiveAdminApi().startDeliveryRoute(routeId),
    onSuccess: async (_data, routeId) => {
      await invalidateDeliveryRoute(queryClient, routeId);
    },
  });
}

export function useMarkStopInProgressMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'delivery', 'mark-in-progress'],
    mutationFn: (vars: { stopId: string; routeId: string }) =>
      requireLiveAdminApi().markStopInProgress(vars.stopId),
    onSuccess: async (_data, vars) => {
      await invalidateDeliveryRoute(queryClient, vars.routeId);
    },
  });
}

export function useCollectDeliveryCodMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'delivery', 'collect-cod'],
    mutationFn: (vars: {
      orderId: string;
      routeId: string;
      collectedAmount: number;
      collectionMethod?: string;
    }) =>
      requireLiveAdminApi().collectDeliveryCod(
        vars.orderId,
        vars.collectedAmount,
        vars.collectionMethod ?? 'CASH_ON_DELIVERY',
      ),
    onSuccess: async (_data, vars) => {
      await invalidateDeliveryRoute(queryClient, vars.routeId);
    },
  });
}

function invalidateDeliveryH5(queryClient: QueryClient) {
  return Promise.all([
    invalidateEntity(queryClient, 'delivery'),
    queryClient.invalidateQueries({ queryKey: queryKeys.snapshot('delivery') }),
    queryClient.invalidateQueries({
      queryKey: ['groaurum', 'delivery', 'boys'],
    }),
    queryClient.invalidateQueries({
      queryKey: ['groaurum', 'delivery', 'vehicles'],
    }),
    queryClient.invalidateQueries({
      queryKey: ['groaurum', 'delivery', 'ops'],
    }),
    queryClient.invalidateQueries({
      queryKey: ['groaurum', 'delivery', 'ready-queue'],
    }),
    queryClient.invalidateQueries({
      queryKey: ['groaurum', 'delivery', 'exceptions'],
    }),
    queryClient.invalidateQueries({
      queryKey: ['groaurum', 'delivery', 'cod-custody'],
    }),
    queryClient.invalidateQueries({
      queryKey: invalidation.entity('orders'),
    }),
  ]);
}

export function useProvisionDeliveryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'delivery', 'provision'],
    mutationFn: (input: {
      displayName: string;
      mobile: string;
      email: string;
      temporaryPassword: string;
      isActive?: boolean;
    }) => requireLiveAdminApi().provisionDelivery(input),
    onSuccess: async () => {
      await invalidateDeliveryH5(queryClient);
    },
  });
}

export function useUpsertDeliveryEmploymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'delivery', 'employment'],
    mutationFn: (input: Parameters<
      LiveAdminApi['upsertDeliveryEmployment']
    >[0]) => requireLiveAdminApi().upsertDeliveryEmployment(input),
    onSuccess: async (_data, input) => {
      await invalidateDeliveryH5(queryClient);
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'delivery', 'boys', 'detail', input.profileId],
      });
    },
  });
}

export function useUpsertVehicleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'delivery', 'vehicle'],
    mutationFn: (input: Parameters<LiveAdminApi['upsertVehicle']>[0]) =>
      requireLiveAdminApi().upsertVehicle(input),
    onSuccess: async () => {
      await invalidateDeliveryH5(queryClient);
    },
  });
}

export function useScheduleAndAssignDeliveryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'delivery', 'schedule-assign'],
    mutationFn: (
      input: Parameters<LiveAdminApi['scheduleAndAssignDelivery']>[0],
    ) => requireLiveAdminApi().scheduleAndAssignDelivery(input),
    onSuccess: async () => {
      await invalidateDeliveryH5(queryClient);
    },
  });
}

export function useSettleDeliveryCodMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'delivery', 'settle-cod'],
    mutationFn: (input: Parameters<LiveAdminApi['settleDeliveryCod']>[0]) =>
      requireLiveAdminApi().settleDeliveryCod(input),
    onSuccess: async () => {
      await invalidateDeliveryH5(queryClient);
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'payments'],
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.snapshot('dashboard'),
      });
    },
  });
}

export function useSettleDeliveryCodSelectedMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'delivery', 'settle-cod-selected'],
    mutationFn: (
      input: Parameters<LiveAdminApi['settleDeliveryCodSelected']>[0],
    ) => requireLiveAdminApi().settleDeliveryCodSelected(input),
    onSuccess: async () => {
      await invalidateDeliveryH5(queryClient);
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'payments'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'delivery', 'cod-custody'],
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.snapshot('dashboard'),
      });
    },
  });
}

export function useConfirmOwnerCodReceiptMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'delivery', 'confirm-owner-cod'],
    mutationFn: (input: {
      deliveryProfileId: string;
      amount: number;
      reference?: string;
      note?: string;
    }) => requireLiveAdminApi().confirmOwnerCodReceipt(input),
    onSuccess: async () => {
      await invalidateDeliveryH5(queryClient);
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'payments'],
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.snapshot('dashboard'),
      });
    },
  });
}

export function useConfirmOwnerCodReceiptSelectedMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'delivery', 'confirm-owner-cod-selected'],
    mutationFn: (
      input: Parameters<LiveAdminApi['confirmOwnerCodReceiptSelected']>[0],
    ) => requireLiveAdminApi().confirmOwnerCodReceiptSelected(input),
    onSuccess: async () => {
      await invalidateDeliveryH5(queryClient);
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'payments'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'delivery', 'cod-custody'],
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.snapshot('dashboard'),
      });
    },
  });
}

export function useVerifyReportedPaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'payments', 'verify-reported'],
    mutationFn: (input: { orderId: string; note?: string | null }) =>
      requireLiveAdminApi().verifyReportedPayment(input.orderId, input.note),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'payments'],
      });
      await invalidateEntity(queryClient, 'orders');
      await invalidateEntity(queryClient, 'dashboard');
    },
  });
}

export function useRejectReportedPaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'payments', 'reject-reported'],
    mutationFn: (input: { orderId: string; note?: string | null }) =>
      requireLiveAdminApi().rejectReportedPayment(input.orderId, input.note),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'payments'],
      });
      await invalidateEntity(queryClient, 'orders');
      await invalidateEntity(queryClient, 'dashboard');
    },
  });
}

export function useCreateDeliveryExceptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'delivery', 'create-exception'],
    mutationFn: (
      input: Parameters<LiveAdminApi['createDeliveryException']>[0],
    ) => requireLiveAdminApi().createDeliveryException(input),
    onSuccess: async () => {
      await invalidateDeliveryH5(queryClient);
    },
  });
}

export function useResolveDeliveryExceptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'delivery', 'resolve-exception'],
    mutationFn: (
      input: Parameters<LiveAdminApi['resolveDeliveryException']>[0],
    ) => requireLiveAdminApi().resolveDeliveryException(input),
    onSuccess: async () => {
      await invalidateDeliveryH5(queryClient);
    },
  });
}

export function useUpsertSettingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'settings', 'upsert'],
    mutationFn: (input: SettingUpsertInput) =>
      requireCrudServices().upsertSetting(input),
    onSuccess: async () => invalidateEntity(queryClient, 'settings'),
  });
}

function invalidateServiceAreaQueries(queryClient: QueryClient) {
  return Promise.all([
    invalidateEntity(queryClient, 'service_areas'),
    invalidateEntity(queryClient, 'settings'),
  ]);
}

export function useCreateServiceAreaMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'service_areas', 'create'],
    mutationFn: (input: ServiceAreaCreateInput) =>
      requireCrudServices().createServiceArea(input),
    onSuccess: async () => invalidateServiceAreaQueries(queryClient),
  });
}

export function useUpdateServiceAreaMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'service_areas', 'update'],
    mutationFn: (vars: { id: string; input: ServiceAreaUpdateInput }) =>
      requireCrudServices().updateServiceArea(vars.id, vars.input),
    onSuccess: async () => invalidateServiceAreaQueries(queryClient),
  });
}

export function useCreateServiceabilityRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'serviceability_rules', 'create'],
    mutationFn: (input: ServiceabilityRuleCreateInput) =>
      requireCrudServices().createServiceabilityRule(input),
    onSuccess: async () => invalidateServiceAreaQueries(queryClient),
  });
}

export function useUpdateServiceabilityRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'serviceability_rules', 'update'],
    mutationFn: (vars: { id: string; input: ServiceabilityRuleUpdateInput }) =>
      requireCrudServices().updateServiceabilityRule(vars.id, vars.input),
    onSuccess: async () => invalidateServiceAreaQueries(queryClient),
  });
}

function invalidateWarehouseQueries(queryClient: QueryClient) {
  return Promise.all([
    invalidateEntity(queryClient, 'operational_locations'),
    invalidateEntity(queryClient, 'settings'),
    invalidateEntity(queryClient, 'inventory'),
  ]);
}

export function useCreateWarehouseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'operational_locations', 'create'],
    mutationFn: (input: WarehouseCreateInput) =>
      requireCrudServices().createWarehouse(input),
    onSuccess: async () => invalidateWarehouseQueries(queryClient),
  });
}

export function useUpdateWarehouseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'operational_locations', 'update'],
    mutationFn: (vars: { id: string; input: WarehouseUpdateInput }) =>
      requireCrudServices().updateWarehouse(vars.id, vars.input),
    onSuccess: async () => invalidateWarehouseQueries(queryClient),
  });
}

function invalidateCompanyExpenseQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: ['groaurum', 'company-expenses'],
    }),
    queryClient.invalidateQueries({
      queryKey: ['groaurum', 'day-book'],
    }),
  ]);
}

export function useCreateCompanyExpenseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'company-expenses', 'create'],
    mutationFn: (input: Parameters<LiveAdminApi['createCompanyExpense']>[0]) =>
      requireLiveAdminApi().createCompanyExpense(input),
    onSuccess: async () => invalidateCompanyExpenseQueries(queryClient),
  });
}

export function useUpdateCompanyExpenseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'company-expenses', 'update'],
    mutationFn: (vars: {
      id: string;
      input: Parameters<LiveAdminApi['createCompanyExpense']>[0];
    }) => requireLiveAdminApi().updateCompanyExpense(vars.id, vars.input),
    onSuccess: async (_data, vars) => {
      await invalidateCompanyExpenseQueries(queryClient);
      await queryClient.invalidateQueries({
        queryKey: ['groaurum', 'company-expenses', 'detail', vars.id],
      });
    },
  });
}

export function useDeleteCompanyExpenseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'company-expenses', 'delete'],
    mutationFn: (id: string) => requireLiveAdminApi().deleteCompanyExpense(id),
    onSuccess: async () => invalidateCompanyExpenseQueries(queryClient),
  });
}

function invalidatePayrollQueries(
  queryClient: QueryClient,
  salesmanId?: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['groaurum', 'payroll'] }),
    queryClient.invalidateQueries({ queryKey: ['groaurum', 'day-book'] }),
    salesmanId
      ? queryClient.invalidateQueries({
          queryKey: ['groaurum', 'salesmen', 'detail', salesmanId],
        })
      : Promise.resolve(),
  ]);
}

export function useCalculateSalesmanPayrollMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'payroll', 'calculate'],
    mutationFn: (input: Parameters<LiveAdminApi['calculateSalesmanPayroll']>[0]) =>
      requireLiveAdminApi().calculateSalesmanPayroll(input),
    onSuccess: async (row) => {
      await invalidatePayrollQueries(queryClient, row.salesmanId);
    },
  });
}

export function useApproveSalesmanPayrollMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'payroll', 'approve'],
    mutationFn: (payrollId: string) =>
      requireLiveAdminApi().approveSalesmanPayroll(payrollId),
    onSuccess: async (row) => {
      await invalidatePayrollQueries(queryClient, row.salesmanId);
    },
  });
}

export function useMarkSalesmanPayrollPaidMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'payroll', 'mark-paid'],
    mutationFn: (input: Parameters<LiveAdminApi['markSalesmanPayrollPaid']>[0]) =>
      requireLiveAdminApi().markSalesmanPayrollPaid(input),
    onSuccess: async (row) => {
      await invalidatePayrollQueries(queryClient, row.salesmanId);
    },
  });
}

export function useSetSalesmanPayrollAdjustmentsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['mutation', 'payroll', 'adjustments'],
    mutationFn: (
      input: Parameters<LiveAdminApi['setSalesmanPayrollAdjustments']>[0],
    ) => requireLiveAdminApi().setSalesmanPayrollAdjustments(input),
    onSuccess: async (row) => {
      await invalidatePayrollQueries(queryClient, row.salesmanId);
    },
  });
}
