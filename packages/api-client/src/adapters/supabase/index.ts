import type {
  CatalogueService,
  DeliveryRouteService,
  InventoryService,
  PaymentService,
  ServiceAreaService,
  ShopService,
} from '../../contracts';
import {
  parseCustomerDataAdapterMode,
  parsePublicSupabaseConfig,
  type CustomerDataAdapterMode,
} from '../../config';
import { createGroAurumSupabaseClient, type GroAurumSupabaseClient } from '../../supabase/client';
import { createSupabaseAuthService } from './auth';
import { createSupabaseCatalogueService } from './catalogue';
import { createSupabaseServiceAreaService } from './service-area';
import { createSupabaseShopService } from './shop';
import { createSupabaseOrderService } from './order';
import { createSupabasePaymentService } from './payment';
import { createSupabaseNotificationService } from './notification';
import { createSupabaseAssistedOrderService } from './assisted-order';
import type { NotificationService } from '../../contracts';

function createProxy<T extends object>(label: string): T {
  return new Proxy({} as T, {
    get(_target, property) {
      return () => {
        throw new Error(
          `${label}.${String(property)}: not available on the customer anon client in Sprint 6.`,
        );
      };
    },
  });
}

export type CustomerAssistedOrderService = ReturnType<
  typeof createSupabaseAssistedOrderService
>;

export type CustomerB2BServices = {
  mode: CustomerDataAdapterMode;
  client: GroAurumSupabaseClient | null;
  catalogue: CatalogueService;
  serviceArea: ServiceAreaService;
  shop: ShopService;
  auth: ReturnType<typeof createSupabaseAuthService>;
  order: ReturnType<typeof createSupabaseOrderService>;
  assistedOrder: CustomerAssistedOrderService;
  payment: PaymentService;
  notification: NotificationService;
  inventory: InventoryService;
  deliveryRoute: DeliveryRouteService;
};

export function createSupabaseCustomerServices(input: {
  url: string;
  anonKey: string;
}): CustomerB2BServices {
  const config = parsePublicSupabaseConfig(input);
  const client = createGroAurumSupabaseClient(config);

  if (typeof console !== 'undefined') {
    console.info('[groaurum] customer data adapter mode: supabase');
  }

  return {
    mode: 'supabase',
    client,
    catalogue: createSupabaseCatalogueService(client),
    serviceArea: createSupabaseServiceAreaService(client),
    shop: createSupabaseShopService(client),
    auth: createSupabaseAuthService(client),
    order: createSupabaseOrderService(client),
    assistedOrder: createSupabaseAssistedOrderService(client),
    payment: createSupabasePaymentService(client),
    notification: createSupabaseNotificationService(client),
    inventory: createProxy<InventoryService>('InventoryService'),
    deliveryRoute: createProxy<DeliveryRouteService>('DeliveryRouteService'),
  };
}

export function assertAdapterMode(value: string | undefined | null): CustomerDataAdapterMode {
  return parseCustomerDataAdapterMode(value);
}

export {
  createSupabaseAuthService,
  createSupabaseCatalogueService,
  createSupabaseServiceAreaService,
  createSupabaseShopService,
  createSupabaseOrderService,
  createSupabasePaymentService,
  createSupabaseNotificationService,
};
export {
  createSupabaseAssistedOrderService,
  type OrderApprovalPreview,
} from './assisted-order';
export {
  createSupabaseSalesmanService,
  type SalesmanService,
  type SalesmanDashboard,
  type SalesmanRetailer,
  type SalesmanVisit,
  type SalesmanPerformance,
  type SalesmanEarningModel,
  type SalesmanTargetProgress,
  type SalesmanSalarySnapshot,
  type SalesmanCommissionLine,
  type SalesmanAwaitingOrder,
  type SalesmanEarnings,
  parseSalesmanTarget,
  parseSalesmanEarnings,
  type SalesmanClaimStatus,
  type SalesmanExpenseCategory,
  type SalesmanExpense,
  type SalesmanExpenseInput,
  type SalesmanReturnRequest,
  type SalesmanReturnInput,
  expenseReceiptObjectPath,
  returnPhotoObjectPath,
  voiceNoteObjectPath,
  type SalesmanMessage,
  type SalesmanNotice,
  type SalesmanVoiceNote,
  type SalesmanAttendance,
  type SalesmanAttendanceStatus,
  type SalesmanDayActionResult,
  type SalesVisitStatus,
  type VisitGpsResult,
  type CompleteVisitInput,
  visitPhotoObjectPath,
  profilePhotoObjectPath,
  type SalesmanOwnProfile,
  type SalesLanguage,
  type UpdateOwnProfileInput,
  type CreateRetailerInput,
  type AssistedOrderLineInput,
  type CatalogueSkuRow,
  type SalesmanOrderSummary,
  type SalesmanOrderDetail,
  type SalesmanOrderLine,
  type SalesmanOrderPreview,
  type OrderPreviewLine,
  type OrderPreviewLineInput,
  type OrderPreviewErrorCode,
  formatOrderNumber,
} from './salesman';
export {
  createSupabaseDeliveryService,
  invokeDeliveryRecordCashPayment,
  parseRecordCashPaymentRpcResult,
  type DeliveryService,
  type DeliveryDashboard,
  type DeliveryRouteSummary,
  type DeliveryStopDetail,
  type CodHistoryRow,
  type RouteCompletionSummary,
  type DeliveryRouteStatus,
  type DeliveryStopStatus,
  type RecordCashPaymentResult,
  type ReportDigitalPaymentResult,
} from './delivery';
export { resolveCustomerSession } from './customer-session';
