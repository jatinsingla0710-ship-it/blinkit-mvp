export * from './contracts';
export type { Database, Enums, Json, Tables, TablesInsert, TablesUpdate } from './database.types';
export {
  DEFAULT_SERVICE_TERRITORY,
  SELLING_UNITS,
  SELLING_UNIT_LABELS,
  CUSTOM_SELLING_UNIT,
  isStandardSellingUnit,
  DELIVERY_FAILURE_REASONS,
  DELIVERY_FAILURE_REASON_LABELS,
  DELIVERY_PROBLEM_REASON_CODES,
  DELIVERY_PROBLEM_REASON_LABELS,
  type SellingUnit,
} from '@groaurum/shared-types';

export {
  CUSTOMER_DATA_ADAPTER_MODES,
  parseCustomerDataAdapterMode,
  parsePublicSupabaseConfig,
  resolvePublicSupabaseConfigFromEnv,
  type CustomerDataAdapterMode,
  type EnvBag,
  type PublicSupabaseConfig,
} from './config';

export {
  createGroAurumSupabaseClient,
  type GroAurumSupabaseClient,
} from './supabase/client';

export { evaluateServiceabilityRules, serviceAreaAcceptsPin } from './serviceability/evaluate';
export { selectEffectiveSkuPrice } from './catalogue/effective-price';

export {
  assertAdapterMode,
  createSupabaseAuthService,
  createSupabaseCatalogueService,
  createSupabaseCustomerServices,
  createSupabaseDeliveryService,
  createSupabaseAssistedOrderService,
  createSupabaseNotificationService,
  createSupabaseOrderService,
  createSupabasePaymentService,
  createSupabaseSalesmanService,
  createSupabaseServiceAreaService,
  createSupabaseShopService,
  invokeDeliveryRecordCashPayment,
  parseRecordCashPaymentRpcResult,
  resolveCustomerSession,
  type AssistedOrderLineInput,
  type CatalogueSkuRow,
  type CodHistoryRow,
  type CreateRetailerInput,
  type CustomerB2BServices,
  type DeliveryDashboard,
  type DeliveryRouteStatus,
  type DeliveryRouteSummary,
  type DeliveryService,
  type DeliveryStopDetail,
  type RecordCashPaymentResult,
  type ReportDigitalPaymentResult,
  type DeliveryStopStatus,
  type OrderApprovalPreview,
  type RouteCompletionSummary,
  type SalesmanAttendance,
  type SalesmanAttendanceStatus,
  type SalesmanDashboard,
  type SalesmanDayActionResult,
  type SalesmanPerformance,
  type SalesmanRetailer,
  type SalesmanService,
  type SalesmanVisit,
  type SalesVisitStatus,
} from './adapters/supabase';

export { createAppLogger, type AppLogger, type LogLevel } from './monitoring/logger';
export {
  loadProviderConfig,
  assertProviderConfig,
  type ProviderConfig,
  type AppRuntimeEnv,
} from './providers/config';
