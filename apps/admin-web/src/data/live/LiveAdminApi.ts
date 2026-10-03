import {
  parseSalesmanTarget,
  type GroAurumSupabaseClient,
  type SalesmanExpense,
  type SalesmanMessage,
  type SalesmanReturnRequest,
  type SalesmanTargetProgress,
  type SalesmanVoiceNote,
} from '@groaurum/api-client';
import {
  formatInr,
  formatInrPrecise,
  formatDateTime,
  formatDate,
  shortCode,
} from './format';
import { deriveUnitPrice } from '../unit-price';
import type { PackAutoAssignResult, DeliveryMissingResource } from '../delivery-setup-helpers';
import {
  isAdjustmentMovementType,
  mapProductInventoryMovementRow,
  mapStockMovementRow,
} from './inventory-movement-map';
import { selectInventoryBalance } from '../inventory-detail-key';
import { formatWacUnitCost } from '../inventory-valuation';
import { blendedAverageUnitCost } from '../inventory-ops';
import { buildPublishChecklist, isPublishReady } from '../publish';
import {
  computeProductReadinessLabel,
  resolveCataloguePublishStatus,
} from '../product-readiness';
import {
  buildOrderTimeline,
  mapDbOrderStatusToFulfillment,
  orderNeedsAttentionFromEvents,
} from '../order-helpers';
import {
  buildActivationWorkflow,
  lifecycleToActivation,
  deriveCustomerOrderClass,
  customerOrderClassLabel,
} from '../customer-helpers';
import {
  buildDigitalAccessVm,
  deriveDigitalAccessStatus,
} from '../customer-digital-access';
import {
  attachAttentionCount,
  buildCustomerAccountSummary,
  buildCustomerAttentionItems,
  buildCustomerTimeline,
  oldestOpenReceivableDays,
} from '../customer-account-dashboard';
import {
  buildCustomerLedger,
  buildReceivablesSnapshot,
  type ReceivablesSnapshot,
} from '../customer-ledger';
import {
  buildDuesAssistantSnapshot,
  type DuesAssistantSnapshot,
} from '../dues-assistant';
import {
  buildProfitAnomalyAssistantSnapshot,
  type ProfitAnomalyAssistantSnapshot,
} from '../profit-anomaly-assistant';
import {
  buildDailyBusinessBriefSnapshot,
  type DailyBusinessBriefSnapshot,
} from '../daily-business-brief';
import {
  buildCompanyExpensesSnapshot,
  mapCompanyExpenseRow,
  validateCompanyExpenseInput,
  type CompanyExpenseInput,
  type CompanyExpenseRow,
  type CompanyExpensesSnapshot,
} from '../company-expenses';
import {
  mapPurchaseItemDbRow,
  mapPurchaseListFields,
  mapSupplierDbRow,
  type PurchaseDetail,
  type PurchaseDraftInput,
  type PurchaseListRow,
  type PurchaseStatus,
  type SupplierInput,
  type SupplierRow,
} from '../purchasing';
import {
  parseBillExtractJson,
  type BillExtractDraft,
  type PurchaseBillScanStatus,
  type PurchaseBillScanVm,
} from '../bill-extract';
import {
  parseReceiptExtractJson,
  type ExpenseReceiptScanStatus,
  type ExpenseReceiptScanVm,
  type ReceiptExtractDraft,
} from '../receipt-extract';
import {
  parseDayBookExtractJson,
  type DayBookExtractDraft,
  type DayBookScanStatus,
  type DayBookScanVm,
} from '../day-book-extract';
import {
  buildUnpaidOrderCandidates,
  parsePaymentProofExtractJson,
  type PaymentProofExtractDraft,
  type PaymentProofScanStatus,
  type PaymentProofScanVm,
  type UnpaidOrderCandidate,
} from '../payment-proof-extract';
import { buildPurchaseAccounting } from '../purchase-accounting';
import {
  buildPurchaseRecommendationsSnapshot,
  inventoryRowToSignal,
  SALES_LOOKBACK_DAYS,
  type PurchaseRecommendationsSnapshot,
  type PurchaseSkuSignal,
} from '../purchase-recommendations';
import {
  buildSupplierLedger,
  buildSupplierPayablesSnapshot,
  mapSupplierPaymentMethod,
  SUPPLIER_PAYMENT_METHOD_LABELS,
  type SupplierLedgerVm,
  type SupplierPayablesSnapshot,
  type SupplierPaymentLedgerInput,
  type SupplierPaymentMethod,
} from '../supplier-ledger';
import {
  buildDayBookSnapshot,
  type DayBookEntryType,
  type DayBookSnapshot,
} from '../day-book';
import {
  buildPayrollMonthSummary,
  mapPayrollRow,
  PAYROLL_PAYMENT_METHOD_LABELS,
  payrollMonthStart,
  type PayrollMonthSummary,
  type PayrollPaymentMethod,
  type PayrollRow,
} from '../salesman-payroll';
import {
  aggregateProductSales,
  buildOwnerFinancialKpis,
  buildProfitLoss,
  filterExpensesByDate,
  sumInventoryCogs,
  sumPaidPayroll,
  sumSalesTotal,
  summarizeDayBookByType,
  type ProfitLossVm,
} from '../financial-reports';
import {
  ACCOUNT_TYPE_LABELS,
  buildTrialBalanceRows,
  journalSourceLabel,
  type AccountType,
  type AccountingSnapshot,
  type ChartAccountRow,
} from '../accounting';
import {
  AP_ACCOUNT_CODE,
  AR_ACCOUNT_CODE,
  BANK_ACCOUNT_CODE,
  CASH_ACCOUNT_CODE,
  attachRunningBalances,
  buildCashBankHonestyNote,
  ledgerAssetBalance,
  ledgerLiabilityBalance,
  type CashBankAccountKind,
  type CashBankExternalKind,
  type CashBankSnapshot,
  type CashBankTransferDirection,
} from '../cash-bank';
import {
  buildGstTaxSummary,
  type GstTaxSummaryVm,
} from '../gst-report';
import {
  buildBalanceSheet,
  buildCashFlowStatement,
  buildGeneralLedgerRows,
  buildLedgerProfitLoss,
  buildLedgerTrialBalance,
  cashBankBalanceFromLines,
  type LedgerLineFact,
  type LedgerStatementsSnapshot,
} from '../financial-statements';
import type { KpiCardItem } from '@/components/dashboard/KpiCards';
import {
  buildInventoryOverview,
  formatAvailableStockLabel,
  formatPackagingLabel,
  formatWarehouseQuantityLabel,
} from '../product-inventory-display';
import {
  buildInventoryStockLabels,
  formatInventoryPackagingLabel,
} from '../inventory-display';
import { OUTER_PACKAGES, resolveOuterPackageKey } from '../pack-units';
import { buildMixedInventoryDisplay } from '@groaurum/catalogue-display';

import {
  mapCompanySettingsToInvoiceCompany,
  mapCompanySettingsToProfile,
} from '../company-settings-map';
import {
  mapSaleItemsToOrderLines,
  mapSaleToPaymentSummary,
} from '../sale-invoice-map';
import {
  formatInventoryQuantityLabel,
  formatQuantityWithUnit,
  humanizeSellingUnit,
} from '../quantity-display';
import {
  buildRevenueByDayFromSales,
  buildSalesReportKpis,
  buildSalesmanLeaderboardFromSales,
  buildTopProductsFromSaleItems,
  salesReportEmptyDetail,
} from '../reports-sales-map';
import {
  countOrdersInCalendarMonth,
  countOrdersThisMonthBySalesman,
  mapSalesVisitStatus,
  mapVisitStatusToDb,
  sumOrderRevenueInCalendarMonth,
  latestOrderAtByShop,
  latestVisitAtByShop,
} from '../salesmen-helpers';
import {
  kolkataWorkDate,
  summarizeFieldToday,
  summarizeVisitCoverage,
} from '../field-ops';
import {
  PREFERRED_PAYMENT_NOT_SET,
  customerHealthOrdersThisMonth,
  resolveOrderPaymentStatus,
  mapPaymentStatusFromDb,
} from '../customers-helpers';
import {
  DOW_LABELS,
  calculateMonthlySalarySummary,
  countScheduledWorkingDays,
  summarizeAttendanceStatuses,
  type AttendanceStatusCode,
  type Dow,
} from '../salesman-salary';
import { mapDbRouteStopStatusToUi } from '../route-stop-status-map';
import { throwRpcError } from '../rpc-error';
import {
  collectionMethodLabel,
  isCodCollectable,
  isOnDeliveryPayment,
  paymentTypeLabelFromPayment,
  summarizeCodFromPayments,
  type PaymentLike,
} from '../delivery-cod';
import { buildDeliveryRouteTimeline } from '../delivery-timeline';
import type { CategoryListItem } from '../category-model';
import type {
  ProductListRow,
  ProductDetail,
  ProductDeletionInfo,
  ProductSkuRow,
  ProductPublishStatus,
  InventoryReadinessStatus,
  SellingUnitVm,
} from '../product-types';
import type {
  SkuPriceListRow,
  SkuPricingDetail,
  PriceRecordRow,
  PriceRecordStatus,
} from '../pricing-types';
import type {
  InventorySnapshot,
  InventoryListRow,
  InventorySkuDetail,
  InventoryHealthStatus,
  StockMovementRow,
  StockReservationRow,
  StockAdjustmentRow,
} from '../inventory-types';
import type {
  CustomersSnapshot,
  CustomerListRow,
  CustomerDetail,
  CustomerAccountStatus,
  CustomerOrderRow,
  CustomerPaymentRow,
  CustomerAddressRow,
  CustomerInvitationResult,
} from '../customers-types';
import type {
  OrdersSnapshot,
  OrderListRow,
  OrderDetail,
  OrderLineItem,
  OrderActivityRow,
  OrderPaymentSummary,
  OrdersNeedingAttentionResult,
  DeliveryStaffOption,
  DeliveryStatusVm,
  PaymentStatusVm,
  WholesaleFulfillmentStatus,
} from '../orders-types';
import type { SkuCommissionRowVm } from '../commission-types';
import type {
  SalesmenSnapshot,
  SalesmanListRow,
  SalesmanDetail,
  SalesmanStatus,
  SalesmanAssignedCustomer,
  SalesmanOrderRow,
  SalesmanCollectionRow,
  SalesmanVisitRow,
  SalesmanAttendanceStatusVm,
  SalesmanEmploymentVm,
  SalesmanSalaryTermsVm,
} from '../salesmen-types';
import type {
  DeliveryAssignableOrder,
  DeliverySnapshot,
  DeliveryRouteListRow,
  DeliveryRouteDetail,
  RouteStatus,
  DeliveryAssignedOrder,
  DeliveryCollectionRow,
} from '../delivery-types';
import { mapDbVehicleStatusToUi } from '../delivery-types';
import { notificationHonestyLabel } from '../delivery-h5-honesty';
import * as deliveryH5 from './deliveryH5Api';
import type {
  DashboardSnapshot,
  OperationsMetric,
  AttentionAlert,
  DashboardQuickAction,
  BusinessActivityItem,
  BusinessActivityKind,
  SalesmanWorkingTodayRow,
  SalesmenWorkingTodaySnapshot,
} from '../dashboard-types';
import {
  mapOpsDashboardKpisToExecutive,
  parseOpsDashboardKpisRpc,
} from '../dashboard-ops-kpis';
import {
  formatPaymentsOverview,
  isCashOrCodPaymentMethod,
  isOnlinePaymentMethod,
  normalizePaymentStatus,
  reconcilePaymentStatus,
  reconciliationStatusLabel,
} from '../payments-recon';
import type {
  PaymentListRow,
  PaymentsOverviewVm,
  PaymentSettlementVm,
} from '../payments-types';
import {
  isSameCalendarDay,
  ordersPresetHref,
  pendingPaymentsTodayHref,
  startOfDay,
  toDateOnly,
} from '../dashboard-helpers';
import {
  businessDateRangeInclusive,
  businessDayEndExclusiveIso,
  businessDayStartIso,
  ymdInBusinessTz,
} from '../business-dates';
import { dateRangeForPreset } from '../sales-fiscal';
import type { ReportsSnapshot, ReportsSection } from '../reports-types';
import type {
  SettingsSnapshot,
  WarehouseRow,
  ServiceAreaRow,
  TaxConfigRow,
} from '../settings-types';
import {
  mergeCustomerLocationHints,
} from '../business-defaults';
import type { ServiceAreaListItem } from '../service-area-model';
import type { WarehouseListItem } from '../warehouse-model';
import {
  mapDbRowToWarehouseListItem,
  mapWarehouseListItemToSettingsRow,
} from '../warehouse-mappers';

type Row = Record<string, unknown>;

/** Tables/RPCs added in migrations before db:types regeneration. */
type UntypedSupabaseClient = {
  from: (table: string) => {
    select: (cols: string) => {
      in: (col: string, vals: string[]) => {
        is: (col: string, val: null) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => Promise<{ data: unknown; error: { message: string } | null }>;
        };
      };
    };
  };
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function str(v: unknown): string {
  if (v == null) return '';
  return String(v);
}

function pinCodesFromRuleConfig(config: unknown): string[] {
  if (!config || typeof config !== 'object') return [];
  const pins = (config as Record<string, unknown>)['pinCodes'];
  if (!Array.isArray(pins)) return [];
  return pins.map((pin) => String(pin));
}

function toSettingsServiceArea(row: ServiceAreaListItem): ServiceAreaRow {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    pinCount: row.pinCount,
    pinCodes: row.pinCodes,
    status: row.status === 'active' ? 'active' : 'disabled',
  };
}

function num(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function moneyRound(v: unknown): number {
  return Math.round(num(v) * 100) / 100;
}

export function mapShopLocation(row: {
  delivery_lat?: unknown;
  delivery_lng?: unknown;
}): {
  deliveryLat: number | null;
  deliveryLng: number | null;
} {
  return {
    deliveryLat: row.delivery_lat == null ? null : num(row.delivery_lat),
    deliveryLng: row.delivery_lng == null ? null : num(row.delivery_lng),
  };
}

function inventoryStatus(available: number): InventoryHealthStatus {
  if (available <= 0) return 'out_of_stock';
  if (available < 10) return 'low';
  return 'healthy';
}

function inventoryReadiness(available: number): InventoryReadinessStatus {
  if (available <= 0) return 'out_of_stock';
  if (available < 10) return 'low_stock';
  return 'in_stock';
}

function priceStatus(row: Row): PriceRecordStatus {
  const now = new Date();
  const from = row['effective_from'] ? new Date(str(row['effective_from'])) : null;
  const to = row['effective_to'] ? new Date(str(row['effective_to'])) : null;
  if (to && to <= now) return 'expired';
  if (from && from > now) return 'expired';
  if (!to) return 'live';
  return 'live';
}

function mapRouteStatus(dbStatus: string): RouteStatus {
  switch (dbStatus) {
    case 'DRAFT':
    case 'PLANNED':
      return 'planned';
    case 'IN_PROGRESS':
      return 'running';
    case 'LOADING':
      return 'loading';
    case 'COMPLETED':
      return 'completed';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'planned';
  }
}

function paymentStatusFromDb(status: string | null): PaymentStatusVm {
  switch (status) {
    case 'PAID':
      return 'PAID';
    case 'PAYMENT_PENDING':
      return 'PENDING';
    case 'UNPAID':
      return 'UNPAID';
    case 'REFUNDED':
      return 'REFUNDED';
    case 'FAILED':
      return 'UNPAID';
    case null:
    case '':
      return 'UNPAID';
    default:
      return 'UNPAID';
  }
}

function deliveryStatusFromOrder(orderStatus: string): DeliveryStatusVm {
  switch (orderStatus) {
    case 'ASSIGNED_TO_ROUTE':
      return 'assigned';
    case 'OUT_FOR_DELIVERY':
      return 'out_for_delivery';
    case 'DELIVERED':
      return 'delivered';
    case 'DELIVERY_FAILED':
      return 'failed';
    default:
      return 'not_started';
  }
}

function sellingUnitVm(unit: string | null | undefined): SellingUnitVm {
  const u = str(unit).trim();
  return u || 'UNIT';
}

function customerBusinessStatusFromShop(
  isActive: boolean,
  lifecycle: string,
): CustomerAccountStatus {
  if (!isActive || lifecycle === 'INACTIVE_OR_FOLLOW_UP') return 'inactive';
  return 'active';
}

function salesmanStatusFromProfile(
  row: Row,
  employmentStatus?: string | null,
): SalesmanStatus {
  const emp = (employmentStatus ?? str(row['employment_status'])).toUpperCase();
  if (emp === 'SUSPENDED') return 'suspended';
  if (emp === 'INACTIVE' || emp === 'TERMINATED') return 'inactive';
  if (emp === 'ON_LEAVE') return 'on_leave';
  if (row['is_active'] === false) return 'inactive';
  return 'active';
}

async function claimMediaUrl(
  sb: GroAurumSupabaseClient,
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const signed = await sb.storage.from('salesman-media').createSignedUrl(path, 60 * 60);
  if (signed.error) return null;
  return signed.data?.signedUrl ?? null;
}

function claimStatus(value: string): SalesmanExpense['status'] {
  if (value === 'APPROVED' || value === 'REJECTED' || value === 'PENDING') return value;
  return 'PENDING';
}

async function mapAdminExpense(
  sb: GroAurumSupabaseClient,
  row: {
    id: string;
    salesman_profile_id: string;
    category: SalesmanExpense['category'];
    amount: number;
    expense_date: string;
    note: string | null;
    receipt_path: string | null;
    status: string;
    review_note: string | null;
    reviewed_at: string | null;
    created_at: string;
  },
): Promise<SalesmanExpense> {
  return {
    id: row.id,
    salesmanProfileId: row.salesman_profile_id,
    category: row.category,
    amount: Number(row.amount),
    expenseDate: String(row.expense_date).slice(0, 10),
    note: row.note,
    receiptPath: row.receipt_path,
    receiptUrl: await claimMediaUrl(sb, row.receipt_path),
    status: claimStatus(row.status),
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

async function mapAdminReturn(
  sb: GroAurumSupabaseClient,
  row: {
    id: string;
    salesman_profile_id: string;
    shop_id: string;
    shop_name: string;
    order_id: string;
    sku_id: string;
    product_name: string;
    sku_name: string;
    sku_code: string;
    quantity: number;
    reason: string;
    note: string | null;
    photo_path: string | null;
    status: string;
    review_note: string | null;
    reviewed_at: string | null;
    created_at: string;
  },
): Promise<SalesmanReturnRequest> {
  return {
    id: row.id,
    salesmanProfileId: row.salesman_profile_id,
    shopId: row.shop_id,
    shopName: row.shop_name,
    orderId: row.order_id,
    skuId: row.sku_id,
    productName: row.product_name,
    skuName: row.sku_name,
    skuCode: row.sku_code,
    quantity: Number(row.quantity),
    reason: row.reason,
    note: row.note,
    photoPath: row.photo_path,
    photoUrl: await claimMediaUrl(sb, row.photo_path),
    status: claimStatus(row.status),
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

export class LiveAdminApi {
  constructor(private readonly sb: GroAurumSupabaseClient) {}

  // ─── Products ───────────────────────────────────────────────────────

  async productList(): Promise<ProductListRow[]> {
    const { data: products } = await this.sb
      .from('products')
      .select('*')
      .is('deleted_at', null);

    if (!products?.length) return [];

    const { data: categories } = await this.sb
      .from('categories')
      .select('id, name, is_active')
      .is('deleted_at', null);
    const catMap = new Map((categories ?? []).map((c) => [c.id, str(c.name)]));
    const activeCategoryIds = new Set(
      (categories ?? [])
        .filter((c) => c.is_active !== false)
        .map((c) => str(c.id)),
    );

    const { data: skus } = await this.sb
      .from('skus')
      .select(
        'id, product_id, is_active, sku_code, name, net_quantity, net_quantity_unit, packs_per_carton',
      )
      .is('deleted_at', null);

    const skuCountMap = new Map<string, number>();
    const skuIdsByProduct = new Map<string, string[]>();
    const activeSkuIdsByProduct = new Map<string, string[]>();
    const primarySkuByProduct = new Map<string, Row>();
    for (const s of skus ?? []) {
      const row = s as unknown as Row;
      const pid = str(row['product_id']);
      skuCountMap.set(pid, (skuCountMap.get(pid) ?? 0) + 1);
      const arr = skuIdsByProduct.get(pid) ?? [];
      arr.push(str(row['id']));
      skuIdsByProduct.set(pid, arr);
      if (row['is_active'] !== false) {
        const activeArr = activeSkuIdsByProduct.get(pid) ?? [];
        activeArr.push(str(row['id']));
        activeSkuIdsByProduct.set(pid, activeArr);
        if (!primarySkuByProduct.has(pid)) {
          primarySkuByProduct.set(pid, row);
        }
      }
    }

    const productIds = (products as Row[]).map((p) => str(p['id']));
    const { data: primaryImages } = productIds.length
      ? await this.sb
          .from('product_images')
          .select('product_id, url, is_primary, display_order')
          .in('product_id', productIds)
          .is('deleted_at', null)
          .eq('media_kind', 'IMAGE')
      : { data: [] as Row[] };
    const imageByProduct = new Map<string, string>();
    for (const img of (primaryImages ?? []) as Row[]) {
      const pid = str(img['product_id']);
      const url = str(img['url']);
      if (!url) continue;
      const existing = imageByProduct.get(pid);
      if (!existing || img['is_primary'] === true) {
        imageByProduct.set(pid, url);
      }
    }

    const allSkuIds = (skus ?? []).map((s) => str(s.id));
    // sku_prices has no deleted_at column — do not filter on it.
    const { data: prices } = allSkuIds.length
      ? await this.sb
          .from('sku_prices')
          .select('sku_id, trade_price, effective_from, effective_to')
          .in('sku_id', allSkuIds)
      : { data: [] as Row[] };

    const livePriceMap = new Map<string, number>();
    const now = new Date();
    for (const p of (prices ?? []) as Row[]) {
      const from = p['effective_from'] ? new Date(str(p['effective_from'])) : null;
      const to = p['effective_to'] ? new Date(str(p['effective_to'])) : null;
      if (from && from > now) continue;
      if (to && to <= now) continue;
      livePriceMap.set(str(p['sku_id']), num(p['trade_price']));
    }

    const { data: balances } = allSkuIds.length
      ? await this.sb
          .from('inventory_balances')
          .select('sku_id, available_quantity')
          .in('sku_id', allSkuIds)
      : { data: [] as Row[] };
    const invMap = new Map<string, number>();
    for (const b of (balances ?? []) as Row[]) {
      const skuId = str(b['sku_id']);
      invMap.set(skuId, num(b['available_quantity']) + (invMap.get(skuId) ?? 0));
    }

    return (products as Row[]).map((p) => {
      const pid = str(p['id']);
      const productSkuIds = skuIdsByProduct.get(pid) ?? [];
      const activeSkuIds = activeSkuIdsByProduct.get(pid) ?? [];
      const primaryPriceSkuId = activeSkuIds[0] ?? productSkuIds[0];
      const primaryPrice = primaryPriceSkuId
        ? livePriceMap.get(primaryPriceSkuId)
        : undefined;
      const totalAvail = productSkuIds.reduce((sum, sid) => sum + (invMap.get(sid) ?? 0), 0);
      const primarySkuRow = primarySkuByProduct.get(pid);
      const primarySkuId = activeSkuIds[0] ?? productSkuIds[0];
      const primaryAvail = primarySkuId ? (invMap.get(primarySkuId) ?? 0) : totalAvail;
      const hasCategory = activeCategoryIds.has(str(p['category_id']));
      const hasActiveSku = activeSkuIds.length > 0;
      const hasLivePriceOnActiveSku = activeSkuIds.some((sid) => livePriceMap.has(sid));
      const publishStatus = this.resolvePublishStatus(
        p,
        activeSkuIds,
        livePriceMap,
        hasCategory,
      );
      const canPublish = hasCategory && hasActiveSku && hasLivePriceOnActiveSku;

      return {
        id: pid,
        name: str(p['name']),
        categoryId: str(p['category_id']),
        categoryName: catMap.get(str(p['category_id'])) ?? '—',
        skuCount: skuCountMap.get(pid) ?? 0,
        primarySkuCode: primarySkuRow ? str(primarySkuRow['sku_code']) : undefined,
        primarySkuName: primarySkuRow ? str(primarySkuRow['name']) : undefined,
        packagingLabel: primarySkuRow
          ? formatPackagingLabel({
              productName: str(p['name']),
              netQuantity:
                primarySkuRow['net_quantity'] != null
                  ? num(primarySkuRow['net_quantity'])
                  : null,
              netQuantityUnit: str(primarySkuRow['net_quantity_unit']) || null,
              packsPerOuter: primarySkuRow['packs_per_carton']
                ? num(primarySkuRow['packs_per_carton'])
                : null,
              variantLabel: primarySkuRow['name']
                ? str(primarySkuRow['name'])
                : null,
            })
          : undefined,
        availablePacks: totalAvail,
        availableStockLabel: primarySkuRow
          ? formatAvailableStockLabel({
              availablePacks: primaryAvail,
              netQuantity:
                primarySkuRow['net_quantity'] != null
                  ? num(primarySkuRow['net_quantity'])
                  : null,
              netQuantityUnit: str(primarySkuRow['net_quantity_unit']) || null,
              packsPerOuter: primarySkuRow['packs_per_carton']
                ? num(primarySkuRow['packs_per_carton'])
                : null,
            })
          : totalAvail > 0
            ? `${totalAvail} packs available`
            : '0 available',
        imageUrl: imageByProduct.get(pid),
        currentTradePriceLabel: primaryPrice != null ? formatInrPrecise(primaryPrice) : '—',
        inventoryStatus: inventoryReadiness(totalAvail),
        publishStatus,
        readinessLabel: computeProductReadinessLabel({
          isActive: p['is_active'] !== false,
          publishStatus,
          skuCount: skuCountMap.get(pid) ?? 0,
          hasActiveSku,
          hasLivePriceOnActiveSku,
          canPublish,
        }),
        updatedAtLabel: formatDateTime(str(p['updated_at'])),
      };
    });
  }

  async productDetail(id: string): Promise<ProductDetail | null> {
    const { data: p } = await this.sb
      .from('products')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();
    if (!p) return null;
    const row = p as unknown as Row;

    const { data: catRow } = await this.sb
      .from('categories')
      .select('id, name, is_active')
      .eq('id', str(row['category_id']))
      .single();

    const { data: skuRows } = await this.sb
      .from('skus')
      .select('*')
      .eq('product_id', id)
      .is('deleted_at', null);

    const skuIds = (skuRows ?? []).map((s) => str((s as unknown as Row)['id']));

    const { data: priceRows } = skuIds.length
      ? await this.sb
          .from('sku_prices')
          .select('*')
          .in('sku_id', skuIds)
          .order('effective_from', { ascending: false })
      : { data: [] as Row[] };

    const { data: balanceRows } = skuIds.length
      ? await this.sb
          .from('inventory_balances')
          .select('*')
          .in('sku_id', skuIds)
      : { data: [] as Row[] };

    const { data: movementRows } = skuIds.length
      ? await this.sb
          .from('inventory_movements')
          .select('*')
          .in('sku_id', skuIds)
          .order('created_at', { ascending: false })
          .limit(20)
      : { data: [] as Row[] };

    const { data: imageRows } = await this.sb
      .from('product_images')
      .select('*')
      .eq('product_id', id)
      .is('deleted_at', null);

    const untypedSb = this.sb as unknown as UntypedSupabaseClient;

    const { data: tierRows } = skuIds.length
      ? await untypedSb
          .from('sku_price_tiers')
          .select('*')
          .in('sku_id', skuIds)
          .is('effective_to', null)
          .order('min_quantity', { ascending: true })
      : { data: [] as Row[] };

    const { data: outerTierRows } = skuIds.length
      ? await untypedSb
          .from('sku_outer_discount_tiers')
          .select('*')
          .in('sku_id', skuIds)
          .is('effective_to', null)
          .order('min_outer_quantity', { ascending: true })
      : { data: [] as Row[] };

    const now = new Date();
    const livePriceMap = new Map<string, number>();
    for (const pr of (priceRows ?? []) as Row[]) {
      const from = pr['effective_from'] ? new Date(str(pr['effective_from'])) : null;
      const to = pr['effective_to'] ? new Date(str(pr['effective_to'])) : null;
      if (from && from > now) continue;
      if (to && to <= now) continue;
      if (!livePriceMap.has(str(pr['sku_id']))) {
        livePriceMap.set(str(pr['sku_id']), num(pr['trade_price']));
      }
    }

    const invMap = new Map<string, number>();
    for (const b of (balanceRows ?? []) as Row[]) {
      const sid = str(b['sku_id']);
      invMap.set(sid, num(b['available_quantity']) + (invMap.get(sid) ?? 0));
    }

    const skus: ProductSkuRow[] = ((skuRows ?? []) as Row[]).map((s) => {
      const sid = str(s['id']);
      const avail = invMap.get(sid) ?? 0;
      return {
        id: sid,
        skuCode: str(s['sku_code']),
        name: str(s['name']),
        grade: str(s['grade']) || undefined,
        specification: str(s['specification']) || undefined,
        sellingUnit: sellingUnitVm(str(s['selling_unit'])),
        netQuantity: s['net_quantity'] != null ? num(s['net_quantity']) : undefined,
        netQuantityUnit: str(s['net_quantity_unit']) || undefined,
        moq: num(s['moq']),
        quantityStep: num(s['quantity_step']) || 1,
        packsPerCarton: s['packs_per_carton'] ? num(s['packs_per_carton']) : undefined,
        outerType: str(s['outer_type']) || undefined,
        packDiscountType: (str(s['pack_discount_type']) || 'none') as ProductSkuRow['packDiscountType'],
        packDiscountValue: num(s['pack_discount_value'] ?? 0),
        containerPriceMode: (str(s['container_price_mode']) || 'calculated') as ProductSkuRow['containerPriceMode'],
        containerCustomPrice:
          s['container_custom_price'] != null
            ? num(s['container_custom_price'])
            : undefined,
        containerDiscountType: (str(s['container_discount_type']) || 'none') as ProductSkuRow['containerDiscountType'],
        containerDiscountValue: num(s['container_discount_value'] ?? 0),
        hsnCode: s['hsn_code'] ? str(s['hsn_code']) : null,
        gstRatePercent:
          s['gst_rate_percent'] != null ? num(s['gst_rate_percent']) : null,
        currentTradePrice: livePriceMap.get(sid),
        currentTradePriceLabel: livePriceMap.has(sid)
          ? formatInrPrecise(livePriceMap.get(sid)!)
          : '—',
        inventoryStatus: inventoryReadiness(avail),
        availableLabel: formatAvailableStockLabel({
          availablePacks: avail,
          netQuantity: s['net_quantity'] != null ? num(s['net_quantity']) : null,
          netQuantityUnit: str(s['net_quantity_unit']) || null,
          packsPerOuter: s['packs_per_carton'] ? num(s['packs_per_carton']) : null,
          outerType: str(s['outer_type']) || null,
        }),
        isActive: s['is_active'] !== false,
      };
    });

    const { data: profiles } = await this.sb.from('profiles').select('id, display_name');
    const profileMap = new Map((profiles ?? []).map((pr) => [pr.id, str(pr.display_name)]));

    const { data: locations } = await this.sb
      .from('operational_locations')
      .select('id, name');
    const locMap = new Map(
      (locations ?? []).map((l) => [
        str((l as unknown as Row)['id']),
        str((l as unknown as Row)['name']),
      ]),
    );

    const priceHistory = ((priceRows ?? []) as Row[]).map((pr) => {
      const sid = str(pr['sku_id']);
      const sku = (skuRows ?? []).find((s) => str((s as unknown as Row)['id']) === sid) as Row | undefined;
      return {
        id: str(pr['id']),
        skuCode: sku ? str(sku['sku_code']) : '—',
        tradePriceLabel: formatInrPrecise(num(pr['trade_price'])),
        effectiveFromLabel: formatDate(str(pr['effective_from'])),
        effectiveToLabel: pr['effective_to'] ? formatDate(str(pr['effective_to'])) : undefined,
        changedByLabel: profileMap.get(str(pr['recorded_by_profile_id'])) ?? '—',
      };
    });

    const skuCodeById = new Map(
      ((skuRows ?? []) as Row[]).map((s) => [str(s['id']), str(s['sku_code'])]),
    );

    const inventoryMovements = ((movementRows ?? []) as Row[]).map((m) =>
      mapProductInventoryMovementRow(m, skuCodeById, locMap),
    );

    const images = ((imageRows ?? []) as Row[])
      .map((img) => ({
        id: str(img['id']),
        url: str(img['url']),
        urlLabel: str(img['url']),
        isPrimary: img['is_primary'] === true,
        altLabel: str(img['alt_text'] ?? img['caption'] ?? 'Product media'),
        mediaKind:
          String(img['media_kind'] ?? 'IMAGE').toUpperCase() === 'VIDEO'
            ? ('VIDEO' as const)
            : ('IMAGE' as const),
        displayOrder: num(img['display_order']),
      }))
      .sort((a, b) => {
        if (a.mediaKind !== b.mediaKind) {
          return a.mediaKind === 'IMAGE' ? -1 : 1;
        }
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return a.displayOrder - b.displayOrder;
      });

    const hasImage = images.some((img) => img.mediaKind === 'IMAGE');
    const primarySku = skus.find((s) => s.isActive) ?? skus[0];
    const totalAvail = skuIds.reduce((sum, sid) => sum + (invMap.get(sid) ?? 0), 0);
    const hasActiveSku = skus.some((s) => s.isActive);
    const hasLivePriceOnActiveSku = skus.some(
      (s) => s.isActive && livePriceMap.has(s.id),
    );
    const hasActiveCategory =
      Boolean(catRow) && (catRow as unknown as Row)['is_active'] !== false;

    const checklist = buildPublishChecklist({
      hasCategory: hasActiveCategory && Boolean(row['category_id']),
      hasImage,
      hasSku: hasActiveSku,
      hasCurrentPrice: hasLivePriceOnActiveSku,
      hasMoq: skus.some((s) => s.isActive && s.moq > 0),
      hasSellingUnit: hasActiveSku,
      hasInventory: totalAvail > 0,
    });

    const isActive = row['is_active'] !== false;
    const publishStatus: ProductPublishStatus = resolveCataloguePublishStatus({
      isActive,
    });

    const productTypeRaw = str(row['product_type']).toUpperCase();
    const productType =
      productTypeRaw === 'BULK' ? ('BULK' as const) : ('PACKED' as const);

    const skuById = new Map(skus.map((sku) => [sku.id, sku]));
    const warehouseStock = ((balanceRows ?? []) as Row[]).map((balance) => {
      const sid = str(balance['sku_id']);
      const sku = skuById.get(sid);
      const available = num(balance['available_quantity']);
      const reserved = num(balance['reserved_quantity']);
      const onHand = num(balance['on_hand_quantity']);
      const packConfig = {
        netQuantity: sku?.netQuantity ?? null,
        netQuantityUnit: sku?.netQuantityUnit ?? null,
        packsPerOuter: sku?.packsPerCarton ?? null,
        outerType: sku?.outerType ?? null,
      };
      const mixed = buildMixedInventoryDisplay({
        totalPacks: available,
        ...packConfig,
      });
      return {
        balanceId: str(balance['id']),
        locationId: str(balance['operational_location_id']),
        locationName:
          locMap.get(str(balance['operational_location_id'])) ?? 'Warehouse',
        skuCode: sku?.skuCode ?? skuCodeById.get(sid) ?? '—',
        availablePacks: available,
        reservedPacks: reserved,
        onHandPacks: onHand,
        availableLabel: formatWarehouseQuantityLabel(
          available,
          packConfig.netQuantity,
          packConfig.netQuantityUnit,
          packConfig.packsPerOuter,
          packConfig.outerType,
        ),
        reservedLabel: formatWarehouseQuantityLabel(
          reserved,
          packConfig.netQuantity,
          packConfig.netQuantityUnit,
          packConfig.packsPerOuter,
          packConfig.outerType,
        ),
        onHandLabel: formatWarehouseQuantityLabel(
          onHand,
          packConfig.netQuantity,
          packConfig.netQuantityUnit,
          packConfig.packsPerOuter,
          packConfig.outerType,
        ),
        mixedSummary: mixed.mixedLabel,
        inventoryStatus: inventoryReadiness(available),
      };
    });

    const primaryAvail = primarySku
      ? (invMap.get(primarySku.id) ?? 0)
      : totalAvail;
    const inventoryOverview = primarySku
      ? buildInventoryOverview({
          availablePacks: primaryAvail,
          netQuantity: primarySku.netQuantity ?? null,
          netQuantityUnit: primarySku.netQuantityUnit ?? null,
          packsPerOuter: primarySku.packsPerCarton ?? null,
          outerType: primarySku.outerType ?? null,
        })
      : buildInventoryOverview({ availablePacks: totalAvail });

    const basePrice = primarySku?.currentTradePrice;
    const priceTiers = ((tierRows ?? []) as Row[])
      .filter((t) => primarySku && str(t['sku_id']) === primarySku.id)
      .map((t) => {
        const minQty = num(t['min_quantity']);
        const unitPrice = num(t['unit_price']);
        const savings =
          basePrice != null && minQty > 0
            ? Math.max(0, (basePrice - unitPrice) * minQty)
            : 0;
        return {
          id: str(t['id']),
          minQuantity: minQty,
          unitPrice,
          unitPriceLabel: formatInrPrecise(unitPrice),
          savingsLabel: savings > 0 ? formatInrPrecise(savings) : undefined,
        };
      });

    const outerKey = resolveOuterPackageKey(primarySku?.outerType ?? '') ?? 'bag';
    const outerPlural =
      OUTER_PACKAGES[outerKey]?.plural ?? 'containers';

    const outerDiscountTiers = ((outerTierRows ?? []) as Row[])
      .filter((t) => primarySku && str(t['sku_id']) === primarySku.id)
      .map((t) => {
        const minOuter = num(t['min_outer_quantity']);
        const discount = num(t['discount_per_outer_unit']);
        return {
          id: str(t['id']),
          minOuterQuantity: minOuter,
          discountPerOuterUnit: discount,
          discountLabel: `Buy ${minOuter}+ ${outerPlural} → Save ${formatInrPrecise(discount)} per ${OUTER_PACKAGES[outerKey]?.label ?? 'unit'}`,
        };
      });

    const primaryImageUrl =
      images.find((img) => img.mediaKind === 'IMAGE' && img.isPrimary)?.url ??
      images.find((img) => img.mediaKind === 'IMAGE')?.url;

    return {
      id: str(row['id']),
      name: str(row['name']),
      description: str(row['description']) || undefined,
      categoryId: str(row['category_id']),
      categoryName: catRow ? str((catRow as unknown as Row)['name']) : '—',
      productType,
      isActive,
      publishStatus,
      inventoryStatus: inventoryReadiness(totalAvail),
      skuCount: skus.length,
      currentTradePriceLabel: primarySku?.currentTradePriceLabel ?? '—',
      updatedAtLabel: formatDateTime(str(row['updated_at'])),
      createdAtLabel: formatDateTime(str(row['created_at'])),
      hasImage,
      primaryImageUrl,
      inventoryOverview,
      warehouseStock,
      skus,
      priceHistory,
      inventoryMovements,
      images,
      priceTiers,
      outerDiscountTiers,
      checklist,
      canPublish: isPublishReady(checklist),
    };
  }

  /**
   * Upload product image (max 4) or video (max 1) to Storage + product_images.
   * Enforces square crop expectation client-side; DB enforces count limits.
   */
  async uploadProductMedia(input: {
    productId: string;
    file: File;
    mediaKind: 'IMAGE' | 'VIDEO';
    altText?: string;
  }): Promise<{ id: string; url: string }> {
    const kind = input.mediaKind;
    const maxBytes = kind === 'IMAGE' ? 5 * 1024 * 1024 : 50 * 1024 * 1024;
    if (input.file.size > maxBytes) {
      throw new Error(
        kind === 'IMAGE'
          ? 'Image must be 5 MB or smaller'
          : 'Video must be 50 MB or smaller',
      );
    }
    const allowedImage = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const allowedVideo = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (
      kind === 'IMAGE' &&
      !allowedImage.includes(input.file.type) &&
      !input.file.type.startsWith('image/')
    ) {
      throw new Error('Unsupported image type');
    }
    if (
      kind === 'VIDEO' &&
      !allowedVideo.includes(input.file.type) &&
      !input.file.type.startsWith('video/')
    ) {
      throw new Error('Unsupported video type');
    }

    const { data: existing } = await this.sb
      .from('product_images')
      .select('id, media_kind, display_order, is_primary')
      .eq('product_id', input.productId)
      .is('deleted_at', null);

    const rows = (existing ?? []) as Row[];
    const imageCount = rows.filter(
      (r) => String(r['media_kind'] ?? 'IMAGE').toUpperCase() !== 'VIDEO',
    ).length;
    const videoCount = rows.filter(
      (r) => String(r['media_kind'] ?? '').toUpperCase() === 'VIDEO',
    ).length;
    if (kind === 'IMAGE' && imageCount >= 4) {
      throw new Error('Maximum 4 product images allowed');
    }
    if (kind === 'VIDEO' && videoCount >= 1) {
      throw new Error('Maximum 1 product video allowed — replace the existing video first');
    }

    const ext =
      input.file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ||
      (kind === 'IMAGE' ? 'jpg' : 'mp4');
    const path = `${input.productId}/${kind.toLowerCase()}-${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await this.sb.storage
      .from('product-media')
      .upload(path, input.file, {
        cacheControl: '3600',
        upsert: false,
        contentType: input.file.type || undefined,
      });
    if (upErr) {
      throw new Error(upErr.message || 'Storage upload failed');
    }

    const { data: pub } = this.sb.storage.from('product-media').getPublicUrl(path);
    const url = pub.publicUrl;
    const maxOrder = rows.reduce(
      (m, r) => Math.max(m, num(r['display_order'])),
      -1,
    );
    const isPrimary =
      kind === 'IMAGE' && !rows.some((r) => r['is_primary'] === true);

    const { data: inserted, error: insErr } = await this.sb
      .from('product_images')
      .insert({
        product_id: input.productId,
        url,
        alt_text: input.altText?.trim() || null,
        display_order: maxOrder + 1,
        is_primary: isPrimary,
        media_kind: kind,
      })
      .select('id, url')
      .single();
    if (insErr) {
      await this.sb.storage.from('product-media').remove([path]);
      throw new Error(insErr.message || 'Could not save media row');
    }

    return { id: str((inserted as Row)['id']), url: str((inserted as Row)['url']) };
  }

  async replaceProductMedia(input: {
    productId: string;
    mediaId: string;
    file: File;
    mediaKind: 'IMAGE' | 'VIDEO';
  }): Promise<{ id: string; url: string }> {
    await this.softDeleteProductMedia(input.mediaId);
    return this.uploadProductMedia({
      productId: input.productId,
      file: input.file,
      mediaKind: input.mediaKind,
    });
  }

  async softDeleteProductMedia(mediaId: string): Promise<void> {
    const { error } = await this.sb.rpc('admin_soft_delete_product_media', {
      p_media_id: mediaId,
    });
    if (error) throw new Error(error.message || 'Could not delete media');
  }

  /** Check whether a product can be permanently deleted or should be archived. */
  async productDeletionInfo(productId: string): Promise<ProductDeletionInfo> {
    const { data: skuRows, error: skuError } = await this.sb
      .from('skus')
      .select('id')
      .eq('product_id', productId)
      .is('deleted_at', null);
    if (skuError) throw new Error(skuError.message || 'Could not load SKUs');

    const skuIds = ((skuRows ?? []) as Row[]).map((s) => str(s['id']));
    let orderLineCount = 0;
    let movementCount = 0;
    let hasStock = false;

    if (skuIds.length > 0) {
      const { count: orderCount, error: orderError } = await this.sb
        .from('order_lines')
        .select('id', { count: 'exact', head: true })
        .in('sku_id', skuIds);
      if (orderError) {
        throw new Error(orderError.message || 'Could not check order history');
      }
      orderLineCount = orderCount ?? 0;

      const { count: movCount, error: movError } = await this.sb
        .from('inventory_movements')
        .select('id', { count: 'exact', head: true })
        .in('sku_id', skuIds);
      if (movError) {
        throw new Error(movError.message || 'Could not check inventory history');
      }
      movementCount = movCount ?? 0;

      const { data: balances, error: balError } = await this.sb
        .from('inventory_balances')
        .select('on_hand_quantity')
        .in('sku_id', skuIds);
      if (balError) {
        throw new Error(balError.message || 'Could not check stock levels');
      }
      hasStock = ((balances ?? []) as Row[]).some(
        (b) => num(b['on_hand_quantity']) > 0,
      );
    }

    const hasHistory = orderLineCount > 0 || movementCount > 0;
    return {
      orderLineCount,
      movementCount,
      hasStock,
      canPermanentlyDelete: !hasHistory && !hasStock,
    };
  }

  async reorderProductImages(
    productId: string,
    imageIds: string[],
  ): Promise<void> {
    const { error } = await this.sb.rpc('admin_reorder_product_images', {
      p_product_id: productId,
      p_image_ids: imageIds,
    });
    if (error) throw new Error(error.message || 'Could not reorder images');
  }

  async setSkuOuterDiscountTiers(input: {
    skuId: string;
    tiers: Array<{ minOuterQuantity: number; discountPerOuterUnit: number }>;
  }): Promise<void> {
    const untypedSb = this.sb as unknown as UntypedSupabaseClient;
    const { error } = await untypedSb.rpc('admin_set_sku_outer_discount_tiers', {
      p_sku_id: input.skuId,
      p_tiers: input.tiers.map((t) => ({
        minOuterQuantity: t.minOuterQuantity,
        discountPerOuterUnit: t.discountPerOuterUnit,
      })),
    });
    if (error) {
      throw new Error(error.message || 'Could not save quantity discounts');
    }
  }

  /** @deprecated Legacy pack-quantity absolute price tiers. */
  async setSkuPriceTiers(input: {
    skuId: string;
    tiers: Array<{ minQuantity: number; unitPrice: number }>;
  }): Promise<void> {
    const untypedSb = this.sb as unknown as UntypedSupabaseClient;
    const { error } = await untypedSb.rpc('admin_set_sku_price_tiers', {
      p_sku_id: input.skuId,
      p_tiers: input.tiers.map((t) => ({
        minQuantity: t.minQuantity,
        unitPrice: t.unitPrice,
      })),
    });
    if (error) throw new Error(error.message || 'Could not save quantity discounts');
  }

  async ensureCategory(name: string): Promise<string> {
    const untypedSb = this.sb as unknown as UntypedSupabaseClient;
    const { data, error } = await untypedSb.rpc('admin_ensure_category', {
      p_name: name.trim(),
      p_is_active: true,
    });
    if (error) throw new Error(error.message || 'Could not ensure category');
    return String(data);
  }

  // ─── Categories ─────────────────────────────────────────────────────

  async categoryList(): Promise<CategoryListItem[]> {
    const { data: cats } = await this.sb
      .from('categories')
      .select('*')
      .is('deleted_at', null);

    const { data: products } = await this.sb
      .from('products')
      .select('id, category_id, is_active')
      .is('deleted_at', null);

    const productRows = (products ?? []) as Row[];
    const productIds = productRows.map((p) => str(p['id']));

    const { data: skus } = productIds.length
      ? await this.sb
          .from('skus')
          .select('id, product_id')
          .is('deleted_at', null)
          .in('product_id', productIds)
      : { data: [] as Row[] };

    const skuIdsByProduct = new Map<string, string[]>();
    for (const s of (skus ?? []) as Row[]) {
      const pid = str(s['product_id']);
      const arr = skuIdsByProduct.get(pid) ?? [];
      arr.push(str(s['id']));
      skuIdsByProduct.set(pid, arr);
    }

    const allSkuIds = (skus ?? []).map((s) => str((s as unknown as Row)['id']));
    const { data: balances } = allSkuIds.length
      ? await this.sb
          .from('inventory_balances')
          .select('sku_id, available_quantity')
          .in('sku_id', allSkuIds)
      : { data: [] as Row[] };

    const invMap = new Map<string, number>();
    for (const b of (balances ?? []) as Row[]) {
      const skuId = str(b['sku_id']);
      invMap.set(skuId, num(b['available_quantity']) + (invMap.get(skuId) ?? 0));
    }

    const stats = new Map<
      string,
      {
        productCount: number;
        activeProductCount: number;
        lowStockCount: number;
        outOfStockCount: number;
      }
    >();

    for (const p of productRows) {
      const cid = str(p['category_id']);
      const pid = str(p['id']);
      const current = stats.get(cid) ?? {
        productCount: 0,
        activeProductCount: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
      };
      current.productCount += 1;
      if (p['is_active'] !== false) current.activeProductCount += 1;
      const skuIds = skuIdsByProduct.get(pid) ?? [];
      const available = skuIds.reduce(
        (sum, sid) => sum + (invMap.get(sid) ?? 0),
        0,
      );
      const stock = inventoryReadiness(available);
      if (stock === 'low_stock') current.lowStockCount += 1;
      if (stock === 'out_of_stock') current.outOfStockCount += 1;
      stats.set(cid, current);
    }

    return ((cats ?? []) as Row[]).map((c) => {
      const id = str(c['id']);
      const s = stats.get(id) ?? {
        productCount: 0,
        activeProductCount: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
      };
      return {
        id,
        name: str(c['name']),
        slug: str(c['slug']) || str(c['name']).toLowerCase().replace(/\s+/g, '-'),
        description: str(c['description']) || undefined,
        productCount: s.productCount,
        activeProductCount: s.activeProductCount,
        lowStockCount: s.lowStockCount,
        outOfStockCount: s.outOfStockCount,
        status: c['is_active'] === false ? 'inactive' as const : 'active' as const,
      };
    });
  }

  async categoryDetail(id: string): Promise<CategoryListItem | null> {
    const list = await this.categoryList();
    return list.find((c) => c.id === id) ?? null;
  }

  // ─── Service areas ──────────────────────────────────────────────────

  async serviceAreaList(): Promise<ServiceAreaListItem[]> {
    const { data: areas, error: areaError } = await this.sb
      .from('service_areas')
      .select('*')
      .is('deleted_at', null)
      .order('display_order', { ascending: true });
    if (areaError) throw areaError;

    const { data: rules, error: ruleError } = await this.sb
      .from('serviceability_rules')
      .select('*')
      .eq('rule_type', 'PIN_CODE');
    if (ruleError) throw ruleError;

    const pinRuleByArea = new Map<
      string,
      { id: string; pinCodes: string[]; isActive: boolean }
    >();
    for (const rule of (rules ?? []) as Row[]) {
      const areaId = str(rule['service_area_id']);
      const pinCodes = pinCodesFromRuleConfig(rule['config']);
      const mapped = {
        id: str(rule['id']),
        pinCodes,
        isActive: rule['is_active'] !== false,
      };
      const existing = pinRuleByArea.get(areaId);
      if (!existing || (mapped.isActive && !existing.isActive)) {
        pinRuleByArea.set(areaId, mapped);
      }
    }

    return ((areas ?? []) as Row[]).map((area) => {
      const pinRule = pinRuleByArea.get(str(area['id']));
      const pinCodes = pinRule?.pinCodes ?? [];
      return {
        id: str(area['id']),
        name: str(area['name']),
        description: str(area['description']),
        status:
          area['is_active'] === false
            ? ('inactive' as const)
            : ('active' as const),
        displayOrder: Number(area['display_order'] ?? 0),
        pinCodes,
        pinCount: pinCodes.length,
        pinRuleId: pinRule?.id ?? null,
      };
    });
  }

  async serviceAreaDetail(id: string): Promise<ServiceAreaListItem | null> {
    const list = await this.serviceAreaList();
    return list.find((row) => row.id === id) ?? null;
  }

  // ─── Warehouses (operational_locations) ─────────────────────────────

  async warehouseList(): Promise<WarehouseListItem[]> {
    const { data: locations, error } = await this.sb
      .from('operational_locations')
      .select('*')
      .is('deleted_at', null)
      .order('name', { ascending: true });
    if (error) throw error;

    return ((locations ?? []) as Row[]).map(mapDbRowToWarehouseListItem);
  }

  async warehouseDetail(id: string): Promise<WarehouseListItem | null> {
    const list = await this.warehouseList();
    return list.find((row) => row.id === id) ?? null;
  }

  async deliveryStaffList(): Promise<DeliveryStaffOption[]> {
    const { data, error } = await this.sb
      .from('profiles')
      .select('id, display_name, mobile')
      .contains('roles', ['DELIVERY'])
      .eq('is_active', true);
    if (error) throw error;
    return ((data ?? []) as Row[]).map((profile) => ({
      id: str(profile['id']),
      name: str(profile['display_name']) || 'Driver',
      mobileLabel: str(profile['mobile']) || undefined,
    }));
  }

  // ─── SKUs ───────────────────────────────────────────────────────────

  async skuList(): Promise<(ProductSkuRow & { productId: string })[]> {
    const { data: skus } = await this.sb
      .from('skus')
      .select('*')
      .is('deleted_at', null);

    if (!skus?.length) return [];

    const skuIds = (skus as unknown as Row[]).map((s) => str(s['id']));

    const { data: prices } = await this.sb
      .from('sku_prices')
      .select('sku_id, trade_price, effective_from, effective_to')
      .in('sku_id', skuIds);

    const now = new Date();
    const livePriceMap = new Map<string, number>();
    for (const p of (prices ?? []) as Row[]) {
      const from = p['effective_from'] ? new Date(str(p['effective_from'])) : null;
      const to = p['effective_to'] ? new Date(str(p['effective_to'])) : null;
      if (from && from > now) continue;
      if (to && to <= now) continue;
      if (!livePriceMap.has(str(p['sku_id']))) {
        livePriceMap.set(str(p['sku_id']), num(p['trade_price']));
      }
    }

    const { data: balances } = await this.sb
      .from('inventory_balances')
      .select('sku_id, available_quantity')
      .in('sku_id', skuIds);
    const invMap = new Map<string, number>();
    for (const b of (balances ?? []) as Row[]) {
      const sid = str(b['sku_id']);
      invMap.set(sid, num(b['available_quantity']) + (invMap.get(sid) ?? 0));
    }

    return (skus as unknown as Row[]).map((s) => {
      const sid = str(s['id']);
      const avail = invMap.get(sid) ?? 0;
      return {
        id: sid,
        productId: str(s['product_id']),
        skuCode: str(s['sku_code']),
        name: str(s['name']),
        grade: str(s['grade']) || undefined,
        specification: str(s['specification']) || undefined,
        sellingUnit: sellingUnitVm(str(s['selling_unit'])),
        netQuantity: s['net_quantity'] != null ? num(s['net_quantity']) : undefined,
        netQuantityUnit: str(s['net_quantity_unit']) || undefined,
        moq: num(s['moq']),
        quantityStep: num(s['quantity_step']) || 1,
        packsPerCarton: s['packs_per_carton'] ? num(s['packs_per_carton']) : undefined,
        hsnCode: s['hsn_code'] ? str(s['hsn_code']) : null,
        gstRatePercent:
          s['gst_rate_percent'] != null ? num(s['gst_rate_percent']) : null,
        currentTradePriceLabel: livePriceMap.has(sid)
          ? formatInrPrecise(livePriceMap.get(sid)!)
          : '—',
        inventoryStatus: inventoryReadiness(avail),
        availableLabel: `${avail}`,
        isActive: s['is_active'] !== false,
      };
    });
  }

  // ─── Pricing ────────────────────────────────────────────────────────

  async priceList(): Promise<SkuPriceListRow[]> {
    const { data: skus } = await this.sb
      .from('skus')
      .select('*')
      .is('deleted_at', null);
    if (!skus?.length) return [];

    const { data: products } = await this.sb
      .from('products')
      .select('id, name')
      .is('deleted_at', null);
    const prodMap = new Map((products ?? []).map((p) => [str((p as unknown as Row)['id']), str((p as unknown as Row)['name'])]));

    const skuIds = (skus as unknown as Row[]).map((s) => str(s['id']));
    const { data: prices } = await this.sb
      .from('sku_prices')
      .select('*')
      .in('sku_id', skuIds)
      .order('effective_from', { ascending: false });

    const now = new Date();
    const liveMap = new Map<string, Row>();

    for (const p of (prices ?? []) as Row[]) {
      const sid = str(p['sku_id']);
      const from = p['effective_from'] ? new Date(str(p['effective_from'])) : null;
      const to = p['effective_to'] ? new Date(str(p['effective_to'])) : null;
      if (from && from > now) continue;
      if (to && to <= now) continue;
      if (!liveMap.has(sid)) liveMap.set(sid, p);
    }

    return (skus as unknown as Row[]).map((s) => {
      const sid = str(s['id']);
      const live = liveMap.get(sid);
      const tradePrice = live ? num(live['trade_price']) : undefined;
      const unit = tradePrice != null
        ? deriveUnitPrice({
            tradePrice,
            netQuantity: s['net_quantity'] != null ? num(s['net_quantity']) : null,
            netQuantityUnit: str(s['net_quantity_unit']) || null,
          })
        : null;
      return {
        id: sid,
        skuId: sid,
        skuCode: str(s['sku_code']),
        skuName: str(s['name']),
        productId: str(s['product_id']),
        productName: prodMap.get(str(s['product_id'])) ?? '—',
        currentPriceLabel: tradePrice != null ? formatInrPrecise(tradePrice) : '—',
        currentTradePrice: tradePrice,
        unitPriceLabel: unit?.unitPriceLabel,
        status: (live ? 'live' : 'unpriced') as PriceRecordStatus,
        updatedAtLabel: formatDateTime(
          str(live?.['created_at'] ?? s['updated_at']),
        ),
      };
    });
  }

  async priceDetail(skuId: string): Promise<SkuPricingDetail | null> {
    const { data: sku } = await this.sb
      .from('skus')
      .select('*')
      .eq('id', skuId)
      .is('deleted_at', null)
      .single();
    if (!sku) return null;
    const skuRow = sku as unknown as Row;

    const { data: product } = await this.sb
      .from('products')
      .select('id, name')
      .eq('id', str(skuRow['product_id']))
      .single();

    const { data: priceRows } = await this.sb
      .from('sku_prices')
      .select('*')
      .eq('sku_id', skuId)
      .order('effective_from', { ascending: false });

    const { data: profiles } = await this.sb.from('profiles').select('id, display_name');
    const profileMap = new Map((profiles ?? []).map((pr) => [pr.id, str(pr.display_name)]));

    let current: PriceRecordRow | null = null;
    const history: PriceRecordRow[] = [];

    for (const pr of (priceRows ?? []) as unknown as Row[]) {
      const status = priceStatus(pr);
      const record: PriceRecordRow = {
        id: str(pr['id']),
        tradePriceLabel: formatInrPrecise(num(pr['trade_price'])),
        tradePrice: num(pr['trade_price']),
        effectiveFromLabel: formatDate(str(pr['effective_from'])),
        effectiveToLabel: pr['effective_to'] ? formatDate(str(pr['effective_to'])) : undefined,
        status,
        createdAtLabel: formatDateTime(str(pr['created_at'])),
        createdByLabel: profileMap.get(str(pr['recorded_by_profile_id'])) ?? '—',
      };

      if (status === 'live' && !current) {
        current = record;
      } else {
        history.push(record);
      }
    }

    const listStatus: PriceRecordStatus = current ? 'live' : 'unpriced';
    const netQuantity =
      skuRow['net_quantity'] != null ? num(skuRow['net_quantity']) : undefined;
    const netQuantityUnit = str(skuRow['net_quantity_unit']) || undefined;

    return {
      skuId,
      skuCode: str(skuRow['sku_code']),
      skuName: str(skuRow['name']),
      productId: str(skuRow['product_id']),
      productName: product ? str((product as unknown as Row)['name']) : '—',
      sellingUnitLabel: str(skuRow['selling_unit']) || 'UNIT',
      netQuantity,
      netQuantityUnit,
      current,
      history,
      listStatus,
      updatedAtLabel: formatDateTime(str(skuRow['updated_at'])),
    };
  }

  // ─── Inventory ──────────────────────────────────────────────────────

  async inventorySnapshot(): Promise<InventorySnapshot> {
    const { data: balances } = await this.sb
      .from('inventory_balances')
      .select('*');

    const { data: skus } = await this.sb
      .from('skus')
      .select('*')
      .is('deleted_at', null);
    const skuMap = new Map(
      (skus ?? []).map((s) => [str((s as unknown as Row)['id']), s as unknown as Row]),
    );

    const { data: products } = await this.sb
      .from('products')
      .select('id, name, category_id')
      .is('deleted_at', null);
    const prodMap = new Map(
      (products ?? []).map((p) => {
        const row = p as unknown as Row;
        return [str(row['id']), row] as const;
      }),
    );

    const { data: categories } = await this.sb
      .from('categories')
      .select('id, name')
      .is('deleted_at', null);
    const catMap = new Map(
      (categories ?? []).map((c) => [
        str((c as unknown as Row)['id']),
        str((c as unknown as Row)['name']),
      ]),
    );

    const productIds = (products ?? []).map((p) => str((p as unknown as Row)['id']));
    const { data: primaryImages } = productIds.length
      ? await this.sb
          .from('product_images')
          .select('product_id, url, is_primary, display_order')
          .in('product_id', productIds)
          .is('deleted_at', null)
          .eq('media_kind', 'IMAGE')
      : { data: [] as Row[] };
    const imageByProduct = new Map<string, string>();
    for (const img of (primaryImages ?? []) as Row[]) {
      const pid = str(img['product_id']);
      const url = str(img['url']);
      if (!url) continue;
      if (!imageByProduct.has(pid) || img['is_primary'] === true) {
        imageByProduct.set(pid, url);
      }
    }

    const { data: locations } = await this.sb
      .from('operational_locations')
      .select('id, name, is_active, deleted_at');
    const locMap = new Map(
      (locations ?? []).map((l) => {
        const row = l as unknown as Row;
        return [str(row['id']), row] as const;
      }),
    );

    type BalanceAgg = {
      balances: Row[];
      totalAvail: number;
      totalReserved: number;
      totalOnHand: number;
    };
    const bySku = new Map<string, BalanceAgg>();
    for (const b of (balances ?? []) as Row[]) {
      const sid = str(b['sku_id']);
      const cur = bySku.get(sid) ?? {
        balances: [],
        totalAvail: 0,
        totalReserved: 0,
        totalOnHand: 0,
      };
      cur.balances.push(b);
      cur.totalAvail += num(b['available_quantity']);
      cur.totalReserved += num(b['reserved_quantity']);
      cur.totalOnHand += num(b['on_hand_quantity'] ?? b['available_quantity']);
      bySku.set(sid, cur);
    }

    const rows: InventoryListRow[] = [];
    for (const [sid, agg] of bySku) {
      const sku = skuMap.get(sid);
      if (!sku) continue;
      const productId = str(sku['product_id']);
      const product = prodMap.get(productId);
      const packConfig = {
        netQuantity: sku['net_quantity'] != null ? num(sku['net_quantity']) : null,
        netQuantityUnit: str(sku['net_quantity_unit']) || null,
        packsPerOuter: sku['packs_per_carton']
          ? num(sku['packs_per_carton'])
          : null,
        outerType: str(sku['outer_type']) || null,
      };
      const stockLabels = buildInventoryStockLabels(agg.totalAvail, packConfig);
      const packagingLabel = formatInventoryPackagingLabel(packConfig);
      const unitLabel = str(sku['selling_unit']) || 'UNIT';
      const warehouseChips = agg.balances.map((b) => {
        const avail = num(b['available_quantity']);
        const loc = locMap.get(str(b['operational_location_id']));
        const labels = buildInventoryStockLabels(avail, packConfig);
        return {
          balanceId: str(b['id']),
          warehouseId: str(b['operational_location_id']),
          warehouseName: loc ? str(loc['name']) : '—',
          mixedStockLabel:
            avail <= 0 ? 'Out of Stock' : labels.mixedLabel,
          status: inventoryStatus(avail),
        };
      });
      const first = agg.balances[0]!;
      const firstLoc = locMap.get(str(first['operational_location_id']));
      const reservedLabel = formatInventoryQuantityLabel({
        quantity: agg.totalReserved,
        sellingUnit: unitLabel,
        netQuantity: packConfig.netQuantity,
        netQuantityUnit: packConfig.netQuantityUnit,
      });
      const stockValue = moneyRound(
        agg.balances.reduce((sum, b) => sum + num(b['stock_value']), 0),
      );
      const valuationIncomplete = agg.balances.some(
        (b) =>
          num(b['on_hand_quantity'] ?? b['available_quantity']) > 0 &&
          b['average_unit_cost'] == null,
      );
      const blended = blendedAverageUnitCost(
        stockValue,
        agg.totalOnHand,
        valuationIncomplete,
      );

      rows.push({
        id: sid,
        skuId: sid,
        skuCode: str(sku['sku_code']),
        skuName: str(sku['name']),
        productId,
        productName: product ? str(product['name']) : '—',
        categoryName: product
          ? catMap.get(str(product['category_id'])) ?? '—'
          : '—',
        imageUrl: imageByProduct.get(productId),
        warehouseId: str(first['operational_location_id']),
        warehouseName: firstLoc ? str(firstLoc['name']) : '—',
        mixedStockLabel: stockLabels.mixedLabel,
        packsTotalLabel: stockLabels.packsTotalLabel,
        weightTotalLabel: stockLabels.weightLabel,
        packagingLabel,
        availablePacks: agg.totalAvail,
        availableLabel: stockLabels.mixedLabel,
        reservedLabel,
        incomingLabel: '—',
        reorderLevelLabel: '—',
        status: inventoryStatus(agg.totalAvail),
        unitLabel,
        warehouseCount: warehouseChips.length,
        warehouses: warehouseChips,
        stockValue,
        stockValueLabel: stockValue > 0 ? formatInr(stockValue) : '—',
        valuationIncomplete,
        averageUnitCost: blended.averageUnitCost,
        averageUnitCostLabel: blended.averageUnitCostLabel,
      });
    }

    rows.sort((a, b) => a.productName.localeCompare(b.productName));

    const totalProducts = rows.length;
    const withStock = rows.filter((r) => r.availablePacks > 0).length;
    const lowCount = rows.filter((r) => r.status === 'low').length;
    const outCount = rows.filter((r) => r.status === 'out_of_stock').length;
    const totalStockValue = moneyRound(
      rows.reduce((sum, row) => sum + row.stockValue, 0),
    );
    const warehouseIds = new Set(
      ((balances ?? []) as Row[]).map((b) => str(b['operational_location_id'])),
    );

    return {
      generatedAtLabel: formatDateTime(new Date().toISOString()),
      kpis: [
        {
          id: 'total_products',
          label: 'Products in Inventory',
          value: `${totalProducts}`,
          hint: 'Tracked SKUs',
        },
        {
          id: 'stock_value',
          label: 'Stock Value',
          value: totalStockValue > 0 ? formatInr(totalStockValue) : '—',
          hint: 'Weighted average cost',
          tone: 'positive',
        },
        {
          id: 'total_stock',
          label: 'Total Stock',
          value: `${withStock}`,
          hint: 'With available qty',
          tone: 'positive',
        },
        {
          id: 'low_stock',
          label: 'Low Stock',
          value: `${lowCount}`,
          tone: 'warning',
        },
        {
          id: 'out_of_stock',
          label: 'Out of Stock',
          value: `${outCount}`,
          tone: 'danger',
        },
        {
          id: 'warehouses',
          label: 'Warehouses',
          value: `${warehouseIds.size}`,
          hint: 'Locations with stock rows',
        },
      ],
      rows,
    };
  }

  /**
   * SKU inventory detail with all warehouse balances.
   * Optional balanceId selects which warehouse's ledger/adjustments/reservations to show.
   */
  async inventoryDetail(
    skuId: string,
    balanceId?: string | null,
  ): Promise<InventorySkuDetail | null> {
    const { data: balanceRows } = await this.sb
      .from('inventory_balances')
      .select('*')
      .eq('sku_id', skuId);
    const balanceList = Array.isArray(balanceRows)
      ? balanceRows
      : balanceRows
        ? [balanceRows]
        : [];
    const balances = (balanceList as Row[]).filter(
      (b) => str(b['sku_id']) === skuId,
    );
    if (balances.length === 0) return null;

    const { data: sku } = await this.sb
      .from('skus')
      .select('*')
      .eq('id', skuId)
      .is('deleted_at', null)
      .single();
    if (!sku) return null;
    const skuRow = sku as unknown as Row;

    const { data: product } = await this.sb
      .from('products')
      .select('id, name, category_id')
      .eq('id', str(skuRow['product_id']))
      .single();

    const productRow = product ? (product as unknown as Row) : null;
    let categoryName = '—';
    if (productRow?.['category_id']) {
      const { data: category } = await this.sb
        .from('categories')
        .select('id, name')
        .eq('id', str(productRow['category_id']))
        .maybeSingle();
      if (category) {
        categoryName = str((category as unknown as Row)['name']) || '—';
      }
    }

    const { data: productImages } = await this.sb
      .from('product_images')
      .select('url, is_primary, display_order')
      .eq('product_id', str(skuRow['product_id']))
      .is('deleted_at', null)
      .eq('media_kind', 'IMAGE')
      .order('display_order', { ascending: true })
      .limit(4);
    let imageUrl: string | undefined;
    for (const img of (productImages ?? []) as Row[]) {
      const url = str(img['url']);
      if (!url) continue;
      if (!imageUrl || img['is_primary'] === true) imageUrl = url;
    }

    const { data: locations } = await this.sb
      .from('operational_locations')
      .select('id, name, is_active, deleted_at');
    const locList = Array.isArray(locations)
      ? locations
      : locations
        ? [locations]
        : [];
    const locRows = locList as Row[];
    const locMap = new Map(locRows.map((l) => [str(l['id']), l]));
    const locNameMap = new Map(
      locRows.map((l) => [str(l['id']), str(l['name'])]),
    );

    const packConfig = {
      netQuantity: num(skuRow['net_quantity']) || null,
      netQuantityUnit: str(skuRow['net_quantity_unit']) || null,
      packsPerOuter: skuRow['packs_per_carton']
        ? num(skuRow['packs_per_carton'])
        : null,
      outerType: str(skuRow['outer_type']) || null,
    };

    const warehouses = balances.map((b) => {
      const locationId = str(b['operational_location_id']);
      const loc = locMap.get(locationId);
      const avail = num(b['available_quantity']);
      const onHand = num(b['on_hand_quantity'] ?? b['available_quantity']);
      const reserved = num(b['reserved_quantity']);
      const warehouseActive =
        Boolean(loc) &&
        loc!['is_active'] !== false &&
        loc!['deleted_at'] == null;
      const qtyOpts = {
        sellingUnit: str(skuRow['selling_unit']),
        netQuantity: num(skuRow['net_quantity']),
        netQuantityUnit: str(skuRow['net_quantity_unit']),
      };
      const availLabels = buildInventoryStockLabels(avail, packConfig);
      const onHandLabels = buildInventoryStockLabels(onHand, packConfig);
      const reservedLabels = buildInventoryStockLabels(reserved, packConfig);
      const averageUnitCost =
        b['average_unit_cost'] == null ? null : num(b['average_unit_cost']);
      const stockValue = moneyRound(b['stock_value']);
      const valuationIncomplete = onHand > 0 && averageUnitCost == null;
      return {
        balanceId: str(b['id']),
        warehouseId: locationId,
        warehouseName: loc ? str(loc['name']) : '—',
        warehouseActive,
        onHandLabel: formatInventoryQuantityLabel({
          quantity: onHand,
          ...qtyOpts,
        }),
        reservedLabel: formatInventoryQuantityLabel({
          quantity: reserved,
          ...qtyOpts,
        }),
        availableLabel: formatInventoryQuantityLabel({
          quantity: avail,
          ...qtyOpts,
        }),
        mixedAvailableLabel: avail <= 0 ? 'Out of Stock' : availLabels.mixedLabel,
        mixedOnHandLabel: onHandLabels.mixedLabel,
        mixedReservedLabel:
          reserved <= 0 ? 'None' : reservedLabels.mixedLabel,
        packsTotalLabel: availLabels.packsTotalLabel,
        availablePacks: avail,
        reservedPacks: reserved,
        onHandQuantity: onHand,
        status: inventoryStatus(avail),
        updatedAtLabel: formatDateTime(str(b['updated_at'])),
        averageUnitCost,
        averageUnitCostLabel: formatWacUnitCost(averageUnitCost),
        stockValue,
        stockValueLabel: stockValue > 0 ? formatInr(stockValue) : '—',
        valuationIncomplete,
      };
    });

    const selected = selectInventoryBalance(warehouses, balanceId);
    if (!selected) return null;
    const selectedBalanceRow = balances.find(
      (b) => str(b['id']) === selected.balanceId,
    );
    if (!selectedBalanceRow) return null;

    const selectedLocationId = selected.warehouseId;

    const { data: movements } = await this.sb
      .from('inventory_movements')
      .select('*')
      .eq('sku_id', skuId)
      .eq('operational_location_id', selectedLocationId)
      .order('created_at', { ascending: false })
      .limit(50);

    const { data: reservations } = await this.sb
      .from('stock_reservations')
      .select('*')
      .eq('sku_id', skuId)
      .eq('operational_location_id', selectedLocationId)
      .order('created_at', { ascending: false })
      .limit(40);

    const { data: profiles } = await this.sb.from('profiles').select('id, display_name');
    const profileMap = new Map((profiles ?? []).map((pr) => [pr.id, str(pr.display_name)]));

    const movementRows = Array.isArray(movements)
      ? movements
      : movements
        ? [movements]
        : [];
    const movementVms: StockMovementRow[] = (movementRows as Row[])
      .filter(
        (m) =>
          str(m['sku_id']) === skuId &&
          str(m['operational_location_id']) === selectedLocationId,
      )
      .map((m) => mapStockMovementRow(m, locNameMap, profileMap));

    const { data: orders } = await this.sb
      .from('orders')
      .select('id, shop_id');
    const orderMap = new Map((orders ?? []).map((o) => [str((o as unknown as Row)['id']), o as Row]));
    const { data: shops } = await this.sb.from('shops').select('*').is('deleted_at', null);
    const shopMap = new Map((shops ?? []).map((s) => [str((s as unknown as Row)['id']), str((s as unknown as Row)['trade_name'])]));

    const reservationRows = Array.isArray(reservations)
      ? reservations
      : reservations
        ? [reservations]
        : [];
    const reservationVms: StockReservationRow[] = (reservationRows as Row[])
      .filter(
        (r) =>
          str(r['sku_id']) === skuId &&
          str(r['operational_location_id']) === selectedLocationId,
      )
      .map((r) => {
        const orderId = str(r['order_id']);
        const order = orderMap.get(orderId);
        const shopName = order ? shopMap.get(str(order['shop_id'])) ?? '—' : '—';
        return {
          id: str(r['id']),
          orderCode: shortCode(orderId, 'GA'),
          shopName,
          quantityLabel: `${num(r['quantity'])}`,
          statusLabel: str(r['status']) || 'reserved',
          reservedAtLabel: formatDateTime(str(r['created_at'])),
          expiresAtLabel: r['expires_at']
            ? formatDateTime(str(r['expires_at']))
            : undefined,
        };
      });

    const adjustments: StockAdjustmentRow[] = movementVms
      .filter((m) => isAdjustmentMovementType(m.type))
      .map((m) => ({
        id: m.id,
        reasonLabel: m.typeLabel,
        quantityLabel: m.quantityLabel,
        warehouseName: m.warehouseName,
        atLabel: m.atLabel,
        recordedByLabel: m.recordedByLabel,
        note: m.note,
      }));

    const avail = num(selectedBalanceRow['available_quantity']);
    const onHand = num(
      selectedBalanceRow['on_hand_quantity'] ??
        selectedBalanceRow['available_quantity'],
    );
    const averageUnitCost =
      selectedBalanceRow['average_unit_cost'] == null
        ? null
        : num(selectedBalanceRow['average_unit_cost']);
    const stockValue = moneyRound(selectedBalanceRow['stock_value']);
    const totalStockValue = moneyRound(
      warehouses.reduce((sum, wh) => sum + wh.stockValue, 0),
    );
    const valuationIncomplete =
      selected.valuationIncomplete ||
      warehouses.some((wh) => wh.valuationIncomplete);
    const valuationNote = valuationIncomplete
      ? 'Some stock has quantity but no purchase cost yet. Receive a purchase bill to start weighted-average valuation.'
      : null;
    const unitLabel = str(skuRow['selling_unit']) || 'UNIT';
    const qtyOpts = {
      sellingUnit: unitLabel,
      netQuantity: num(skuRow['net_quantity']),
      netQuantityUnit: str(skuRow['net_quantity_unit']),
    };

    const totalAvailablePacks = warehouses.reduce(
      (sum, wh) => sum + wh.availablePacks,
      0,
    );
    const totalLabels = buildInventoryStockLabels(
      totalAvailablePacks,
      packConfig,
    );

    return {
      skuId,
      skuCode: str(skuRow['sku_code']),
      skuName: str(skuRow['name']),
      productId: str(skuRow['product_id']),
      productName: productRow ? str(productRow['name']) : '—',
      categoryName,
      imageUrl,
      totalAvailablePacks,
      totalMixedStockLabel: totalLabels.mixedLabel,
      totalPacksLabel: totalLabels.packsTotalLabel,
      totalWeightLabel: totalLabels.weightLabel,
      overallStatus: inventoryStatus(totalAvailablePacks),
      packagingLabel: formatInventoryPackagingLabel(packConfig),
      warehouses,
      balanceId: selected.balanceId,
      warehouseId: selected.warehouseId,
      warehouseName: selected.warehouseName,
      warehouseActive: selected.warehouseActive,
      unitLabel,
      onHandLabel: formatInventoryQuantityLabel({
        quantity: onHand,
        ...qtyOpts,
      }),
      availableLabel: formatInventoryQuantityLabel({
        quantity: avail,
        ...qtyOpts,
      }),
      reservedLabel: formatInventoryQuantityLabel({
        quantity: num(selectedBalanceRow['reserved_quantity']),
        ...qtyOpts,
      }),
      incomingLabel: '—',
      reorderLevelLabel: '—',
      onHandQuantity: onHand,
      netQuantity: num(skuRow['net_quantity']) || undefined,
      netQuantityUnit: str(skuRow['net_quantity_unit']) || undefined,
      packsPerCarton: skuRow['packs_per_carton']
        ? num(skuRow['packs_per_carton'])
        : undefined,
      outerType: str(skuRow['outer_type']) || undefined,
      averageUnitCost,
      averageUnitCostLabel: formatWacUnitCost(averageUnitCost),
      stockValue,
      stockValueLabel: stockValue > 0 ? formatInr(stockValue) : '—',
      totalStockValue,
      totalStockValueLabel:
        totalStockValue > 0 ? formatInr(totalStockValue) : '—',
      valuationMethodLabel: 'Weighted average cost',
      valuationNote,
      valuationIncomplete,
      status: inventoryStatus(avail),
      updatedAtLabel: formatDateTime(str(selectedBalanceRow['updated_at'])),
      movements: movementVms,
      reservations: reservationVms,
      adjustments,
    };
  }

  // ─── Customers ──────────────────────────────────────────────────────

  async findCustomersByMobile(mobile: string): Promise<
    {
      shopId: string;
      shopName: string;
      ownerName: string;
      mobile: string;
      isActive: boolean;
    }[]
  > {
    const trimmed = mobile.trim();
    if (!trimmed) return [];

    const { data: normalized, error: normError } = await this.sb.rpc(
      'normalize_mobile',
      { p_mobile: trimmed },
    );
    if (normError) throw normError;
    const normMobile = str(normalized);

    const { data: contacts, error: contactError } = await this.sb
      .from('shop_contacts')
      .select('shop_id, name, mobile, shops!inner(trade_name, is_active, deleted_at)')
      .eq('mobile', normMobile);
    if (contactError) throw contactError;

    return ((contacts ?? []) as Row[])
      .filter((row) => {
        const shop = row['shops'] as Row | null;
        return shop && shop['deleted_at'] == null;
      })
      .map((row) => {
        const shop = row['shops'] as Row;
        return {
          shopId: str(row['shop_id']),
          shopName: str(shop['trade_name']),
          ownerName: str(row['name']),
          mobile: str(row['mobile']),
          isActive: shop['is_active'] === true,
        };
      });
  }

  async customersSnapshot(): Promise<CustomersSnapshot> {
    const { data: shops } = await this.sb
      .from('shops')
      .select('*')
      .is('deleted_at', null);

    if (!shops?.length) {
      const activeAreaDefaults = await this.activeServiceAreaDefaults();
      return {
        generatedAtLabel: formatDateTime(new Date().toISOString()),
        kpis: [],
        rows: [],
        ...(activeAreaDefaults ? { createDefaults: activeAreaDefaults } : {}),
      };
    }

    const shopIds = (shops as unknown as Row[]).map((s) => str(s['id']));

    const { data: contacts } = await this.sb
      .from('shop_contacts')
      .select('*')
      .in('shop_id', shopIds);

    const ownerMap = new Map<string, string>();
    const mobileMap = new Map<string, string>();
    for (const c of (contacts ?? []) as Row[]) {
      if (c['is_primary'] === true) {
        ownerMap.set(str(c['shop_id']), str(c['name']));
        mobileMap.set(str(c['shop_id']), str(c['mobile']));
      }
    }

    const { data: authLinks } = await this.sb
      .from('shop_auth_links')
      .select('shop_id, linked_at')
      .in('shop_id', shopIds);
    const authLinkMap = new Map(
      ((authLinks ?? []) as Row[]).map((row) => [
        str(row['shop_id']),
        str(row['linked_at']),
      ]),
    );

    const { data: pendingInvites } = await this.sb
      .from('shop_invitations')
      .select('shop_id, sent_at')
      .in('shop_id', shopIds)
      .eq('status', 'PENDING');
    const pendingInviteMap = new Map(
      ((pendingInvites ?? []) as Row[]).map((row) => [
        str(row['shop_id']),
        str(row['sent_at']),
      ]),
    );

    const appLinkSentMap = new Map<string, { at: string; byId: string | null }>();
    for (const s of shops as unknown as Row[]) {
      const sid = str(s['id']);
      const sentAt = s['last_app_link_sent_at'];
      if (sentAt) {
        appLinkSentMap.set(sid, {
          at: str(sentAt),
          byId: s['last_app_link_sent_by_profile_id']
            ? str(s['last_app_link_sent_by_profile_id'])
            : null,
        });
      }
    }

    const { data: areas } = await this.sb.from('service_areas').select('id, name');
    const areaMap = new Map((areas ?? []).map((a) => [str((a as unknown as Row)['id']), str((a as unknown as Row)['name'])]));

    const { data: profiles } = await this.sb.from('profiles').select('id, display_name');
    const profileMap = new Map((profiles ?? []).map((pr) => [pr.id, str(pr.display_name)]));

    const { data: ordersData } = await this.sb
      .from('orders')
      .select('shop_id, created_at')
      .in('shop_id', shopIds)
      .order('created_at', { ascending: false });
    const lastOrderMap = new Map<string, string>();
    for (const o of (ordersData ?? []) as Row[]) {
      const sid = str(o['shop_id']);
      if (!lastOrderMap.has(sid)) lastOrderMap.set(sid, str(o['created_at']));
    }

    const rows: CustomerListRow[] = (shops as unknown as Row[]).map((s) => {
      const sid = str(s['id']);
      const lifecycle = str(s['lifecycle_status']);
      const isActive = s['is_active'] !== false;
      const hasAuthLink = authLinkMap.has(sid);
      const appLinkRecord = appLinkSentMap.get(sid);
      const hasAppLinkSent =
        Boolean(appLinkRecord) || pendingInviteMap.has(sid);
      const digitalAccess = deriveDigitalAccessStatus({
        isActive,
        hasAuthLink,
        hasAppLinkSent,
      });
      const digitalAccessVm = buildDigitalAccessVm({
        isActive,
        hasAuthLink,
        hasAppLinkSent,
        primaryMobile: mobileMap.get(sid),
        appLinkSentAtLabel: appLinkRecord
          ? formatDateTime(appLinkRecord.at)
          : pendingInviteMap.has(sid)
            ? formatDateTime(pendingInviteMap.get(sid)!)
            : null,
        appLinkSentByLabel: appLinkRecord?.byId
          ? profileMap.get(appLinkRecord.byId) ?? 'Staff'
          : pendingInviteMap.has(sid) && !appLinkRecord
            ? 'Legacy invitation'
            : null,
        activatedAtLabel: authLinkMap.has(sid)
          ? formatDateTime(authLinkMap.get(sid)!)
          : null,
      });
      return {
        id: sid,
        shopName: str(s['trade_name']),
        ownerName: ownerMap.get(sid) ?? '-',
        phoneLabel: mobileMap.get(sid) ?? '-',
        areaLabel: areaMap.get(str(s['service_area_id'])) ?? '-',
        serviceAreaId: str(s['service_area_id']) || undefined,
        salesmanName: profileMap.get(str(s['assigned_salesman_profile_id'])) ?? '-',
        lastOrderLabel: lastOrderMap.has(sid) ? formatDate(lastOrderMap.get(sid)!) : '-',
        preferredPayment: PREFERRED_PAYMENT_NOT_SET,
        status: customerBusinessStatusFromShop(isActive, lifecycle),
        digitalAccess,
        digitalAccessLabel: digitalAccessVm.label,
        createdAtIso: str(s['created_at']),
        appLinkSentAtIso: appLinkRecord?.at,
      };
    });

    const total = rows.length;
    const active = rows.filter((r) => r.status === 'active').length;
    const recentlyAdded = rows.filter((r) => {
      const created = new Date(r.createdAtIso);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return created >= weekAgo;
    }).length;

    const firstShop = (shops as unknown as Row[])[0];
    const activeAreaDefaults = await this.activeServiceAreaDefaults();
    const createDefaults = this.buildCustomerCreateDefaults(
      activeAreaDefaults,
      firstShop,
    );

    return {
      generatedAtLabel: formatDateTime(new Date().toISOString()),
      kpis: [
        {
          id: 'total',
          label: 'Total Customers',
          value: `${total}`,
          hint: 'Retail shops in the network',
        },
        {
          id: 'active',
          label: 'Active Customers',
          value: `${active}`,
          hint: 'Operational for orders and delivery',
          tone: 'positive',
        },
        {
          id: 'recent',
          label: 'Recently Added',
          value: `${recentlyAdded}`,
          hint: 'Added in the last 7 days',
        },
      ],
      rows,
      ...(createDefaults ? { createDefaults } : {}),
    };
  }

  private buildCustomerCreateDefaults(
    activeAreaDefaults: {
      serviceAreaId: string;
      deliveryCity: string;
      deliveryState: string;
      deliveryPinCode: string;
    } | null,
    shop?: Row,
  ) {
    const merged = mergeCustomerLocationHints(
      activeAreaDefaults ?? {
        serviceAreaId: str(shop?.['service_area_id']),
        deliveryCity: str(shop?.['delivery_city']),
        deliveryState: str(shop?.['delivery_state']),
        deliveryPinCode: str(shop?.['delivery_pin_code']),
      },
      {
        serviceAreaId: str(shop?.['service_area_id']) || undefined,
        deliveryCity: str(shop?.['delivery_city']) || undefined,
        deliveryState: str(shop?.['delivery_state']) || undefined,
        deliveryPinCode: str(shop?.['delivery_pin_code']) || undefined,
      },
    );
    if (!merged.serviceAreaId || !merged.deliveryPinCode) return null;
    return merged;
  }

  private async activeServiceAreaDefaults(): Promise<
    | {
        serviceAreaId: string;
        deliveryCity: string;
        deliveryState: string;
        deliveryPinCode: string;
      }
    | null
  > {
    const areas = await this.serviceAreaList();
    const active = areas.find((area) => area.status === 'active');
    if (!active || active.pinCodes.length === 0) return null;
    return {
      serviceAreaId: active.id,
      deliveryCity: '',
      deliveryState: '',
      deliveryPinCode: active.pinCodes[0],
    };
  }

  async customerDetail(id: string): Promise<CustomerDetail | null> {
    const { data: shop } = await this.sb
      .from('shops')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();
    if (!shop) return null;
    const s = shop as unknown as Row;

    const { data: contacts } = await this.sb
      .from('shop_contacts')
      .select('*')
      .eq('shop_id', id);
    const primary = ((contacts ?? []) as Row[]).find((c) => c['is_primary'] === true);

    const { data: areas } = await this.sb.from('service_areas').select('id, name');
    const areaMap = new Map((areas ?? []).map((a) => [str((a as unknown as Row)['id']), str((a as unknown as Row)['name'])]));

    const { data: profiles } = await this.sb.from('profiles').select('id, display_name');
    const profileMap = new Map((profiles ?? []).map((pr) => [pr.id, str(pr.display_name)]));

    const { data: addresses } = await this.sb
      .from('customer_addresses')
      .select('*')
      .eq('shop_id', id);

    const { data: ordersData } = await this.sb
      .from('orders')
      .select('*')
      .eq('shop_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    const orderIds = ((ordersData ?? []) as Row[]).map((o) => str(o['id']));
    const { data: payments } = orderIds.length
      ? await this.sb
          .from('payments')
          .select('*')
          .in('order_id', orderIds)
      : { data: [] as Row[] };

    const lifecycle = str(s['lifecycle_status']);
    const activationState = lifecycleToActivation(lifecycle);
    const activation = buildActivationWorkflow(activationState, {});

    const paymentRows = (payments ?? []) as Row[];

    const customerOrders: CustomerOrderRow[] = ((ordersData ?? []) as Row[]).map((o) => {
      const oid = str(o['id']);
      const fulfillmentStatus = str(o['status']);
      const createdAt = str(o['created_at']);
      const invoiceNumber = o['invoice_number']
        ? str(o['invoice_number'])
        : null;
      return {
        id: oid,
        orderCode: shortCode(oid, 'GA'),
        valueLabel: formatInr(num(o['total'])),
        fulfillmentLabel: fulfillmentStatus.replace(/_/g, ' '),
        fulfillmentStatus,
        paymentStatus: resolveOrderPaymentStatus(
          oid,
          paymentRows.map((p) => ({
            order_id: str(p['order_id']),
            status: str(p['status']),
            created_at: str(p['created_at']),
          })),
        ),
        placedAtLabel: formatDateTime(createdAt),
        placedAtIso: createdAt,
        invoiceNumber,
        totalAmount: num(o['total']),
      };
    });

    const customerPayments: CustomerPaymentRow[] = paymentRows.map((p) => {
      const paidAt = p['paid_at'] ? str(p['paid_at']) : null;
      const createdAt = p['created_at'] ? str(p['created_at']) : '';
      const atIso = paidAt || createdAt;
      return {
        id: str(p['id']),
        orderCode: shortCode(str(p['order_id']), 'GA'),
        orderId: str(p['order_id']),
        methodLabel: str(p['method']) || '—',
        amountLabel: formatInr(num(p['amount'])),
        status: mapPaymentStatusFromDb(str(p['status'])),
        atLabel: formatDateTime(atIso),
        atIso,
      };
    });

    const addressRows: CustomerAddressRow[] = ((addresses ?? []) as Row[])
      .filter((a) => a['deleted_at'] == null)
      .map((a) => ({
        id: str(a['id']),
        label: str(a['label']) || 'Delivery',
        text: [
          str(a['address_line'] || a['line1']),
          str(a['city']),
          str(a['state']),
          str(a['pin_code'] || a['pincode']),
        ]
          .filter(Boolean)
          .join(', '),
        isPrimary: a['is_default'] === true || a['is_primary'] === true,
        serviceable: a['is_serviceable'] !== false,
      }));

    const { data: monthOrdersData } = await this.sb
      .from('orders')
      .select('id, created_at, total, status')
      .eq('shop_id', id);
    const countableOrders = ((monthOrdersData ?? []) as Row[]).filter(
      (o) => str(o['status']) !== 'CANCELLED',
    );
    const allOrderRows = countableOrders.map((o) => ({
      created_at: str(o['created_at']),
      total: num(o['total']),
    }));
    const monthHealth = customerHealthOrdersThisMonth(allOrderRows);
    const orderClass = deriveCustomerOrderClass(lifecycle, allOrderRows.length);
    const lastOrderDate = ordersData?.length
      ? str((ordersData[0] as unknown as Row)['created_at'])
      : null;

    const { data: pendingInvite } = await this.sb
      .from('shop_invitations')
      .select('expires_at, sent_at')
      .eq('shop_id', id)
      .eq('status', 'PENDING')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: authLink } = await this.sb
      .from('shop_auth_links')
      .select('linked_at, auth_user_id')
      .eq('shop_id', id)
      .maybeSingle();

    let linkedLoginMobile: string | null = null;
    if (authLink?.auth_user_id) {
      const { data: linkedProfile } = await this.sb
        .from('profiles')
        .select('mobile')
        .eq('id', authLink.auth_user_id)
        .maybeSingle();
      linkedLoginMobile = linkedProfile?.mobile
        ? str(linkedProfile.mobile)
        : null;
    }

    const isActive = s['is_active'] !== false;
    const hasAuthLink = Boolean(authLink);
    const appLinkSentAt = s['last_app_link_sent_at']
      ? str(s['last_app_link_sent_at'])
      : null;
    const appLinkSentById = s['last_app_link_sent_by_profile_id']
      ? str(s['last_app_link_sent_by_profile_id'])
      : null;
    const hasAppLinkSent = Boolean(appLinkSentAt) || Boolean(pendingInvite?.expires_at);
    const digitalAccessVm = buildDigitalAccessVm({
      isActive,
      hasAuthLink,
      hasAppLinkSent,
      primaryMobile: primary ? str(primary['mobile']) : null,
      appLinkSentAtLabel: appLinkSentAt
        ? formatDateTime(appLinkSentAt)
        : pendingInvite?.sent_at
          ? formatDateTime(str(pendingInvite.sent_at))
          : null,
      appLinkSentByLabel: appLinkSentById
        ? profileMap.get(appLinkSentById) ?? 'Staff'
        : pendingInvite && !appLinkSentAt
          ? 'Legacy invitation'
          : null,
      activatedAtLabel: authLink?.linked_at
        ? formatDateTime(str(authLink.linked_at))
        : null,
    });

    const allOrderIds = countableOrders.map((o) => str(o['id']));
    const { data: allPaymentsData } = allOrderIds.length
      ? await this.sb
          .from('payments')
          .select(
            'id, order_id, status, amount, cash_collected_amount, online_collected_amount, paid_at, created_at, collection_method, method_intent',
          )
          .in('order_id', allOrderIds)
      : { data: [] as Row[] };

    const orderAggregates = countableOrders.map((o) => ({
      id: str(o['id']),
      status: str(o['status']),
      total: num(o['total']),
      created_at: str(o['created_at']),
      order_code: shortCode(str(o['id']), 'GA'),
    }));
    const paymentAggregates = ((allPaymentsData ?? []) as Row[]).map((p) => {
      const collectionMethod = p['collection_method']
        ? str(p['collection_method'])
        : '';
      const methodIntent = p['method_intent'] ? str(p['method_intent']) : '';
      const methodLabel = collectionMethod
        ? collectionMethodLabel(collectionMethod)
        : methodIntent === 'PAY_ONLINE_NOW'
          ? 'Online'
          : methodIntent === 'PAY_ON_DELIVERY'
            ? 'Pay on delivery'
            : null;
      return {
        id: str(p['id']),
        order_id: str(p['order_id']),
        status: str(p['status']),
        amount: num(p['amount']),
        cash_collected_amount: num(p['cash_collected_amount']),
        online_collected_amount: num(p['online_collected_amount']),
        paid_at: p['paid_at'] ? str(p['paid_at']) : null,
        created_at: p['created_at'] ? str(p['created_at']) : null,
        method_label: methodLabel,
      };
    });

    const ledger = buildCustomerLedger({
      orders: orderAggregates,
      payments: paymentAggregates,
    });
    const oldestOpenDays = oldestOpenReceivableDays(
      orderAggregates,
      paymentAggregates,
    );
    const attentionItems = buildCustomerAttentionItems(customerOrders, {
      outstanding: ledger.outstanding,
      outstandingLabel: ledger.outstandingLabel,
      oldestOpenDays,
      collectHref: ledger.collectHref,
    });
    const summary = attachAttentionCount(
      buildCustomerAccountSummary({
        orders: orderAggregates,
        payments: paymentAggregates,
      }),
      attentionItems,
    );
    const location = mapShopLocation({
      delivery_lat: s['delivery_lat'],
      delivery_lng: s['delivery_lng'],
    });

    const detail: CustomerDetail = {
      id: str(s['id']),
      shopName: str(s['trade_name']),
      ownerName: primary ? str(primary['name']) : '—',
      phoneLabel: primary ? str(primary['mobile']) : '—',
      emailLabel: primary?.['email'] ? str(primary['email']) : null,
      linkedLoginMobileLabel: linkedLoginMobile,
      contactMobileMatchesLogin: linkedLoginMobile
        ? linkedLoginMobile === (primary ? str(primary['mobile']) : '')
        : true,
      areaLabel: areaMap.get(str(s['service_area_id'])) ?? '—',
      serviceAreaId: str(s['service_area_id']) || undefined,
      legalName: s['legal_name'] != null ? str(s['legal_name']) : null,
      deliveryAddressLine: str(s['delivery_address_line']) || undefined,
      deliveryCity: str(s['delivery_city']) || undefined,
      deliveryState: str(s['delivery_state']) || undefined,
      deliveryPinCode: str(s['delivery_pin_code']) || undefined,
      assignedSalesmanProfileId:
        str(s['assigned_salesman_profile_id']) || undefined,
      salesmanName: profileMap.get(str(s['assigned_salesman_profile_id'])) ?? '—',
      preferredPayment: PREFERRED_PAYMENT_NOT_SET,
      status: customerBusinessStatusFromShop(isActive, lifecycle),
      digitalAccess: digitalAccessVm.status,
      digitalAccessVm,
      activationState,
      orderClass,
      orderClassLabel: customerOrderClassLabel(orderClass),
      deliveryLat: location.deliveryLat,
      deliveryLng: location.deliveryLng,
      hasPendingInvitation: Boolean(pendingInvite?.expires_at),
      pendingInvitationExpiresAtLabel: pendingInvite?.expires_at
        ? formatDateTime(str(pendingInvite.expires_at))
        : null,
      appLinkSentAtLabel: digitalAccessVm.appLinkSentAtLabel ?? null,
      appLinkSentByLabel: digitalAccessVm.appLinkSentByLabel ?? null,
      createdAtLabel: formatDateTime(str(s['created_at'])),
      updatedAtLabel: formatDateTime(str(s['updated_at'])),
      health: {
        ordersThisMonth: monthHealth.ordersThisMonth,
        averageOrderValueLabel: formatInr(monthHealth.averageOrderValue),
        lastOrderDateLabel: lastOrderDate ? formatDate(lastOrderDate) : '—',
        lastPaymentStatus: customerPayments.length
          ? customerPayments[0].status
          : 'UNKNOWN',
      },
      summary,
      ledger,
      attentionItems,
      timeline: [],
      activation,
      orders: customerOrders,
      payments: customerPayments,
      addresses: addressRows,
      activity: [],
      documents: [],
    };

    return {
      ...detail,
      timeline: buildCustomerTimeline({
        ...detail,
        createdAtIso: str(s['created_at']),
        outstandingLabel:
          ledger.outstanding > 0 ? ledger.outstandingLabel : null,
      }),
    };
  }

  /**
   * Customer receivables derived from orders ⨝ payments residual.
   * No separate ledger / balance table.
   */
  async receivablesSnapshot(): Promise<ReceivablesSnapshot> {
    const { data: shops } = await this.sb
      .from('shops')
      .select('id, trade_name, service_area_id')
      .is('deleted_at', null);

    if (!shops?.length) {
      return buildReceivablesSnapshot({
        generatedAtIso: new Date().toISOString(),
        customers: [],
      });
    }

    const shopRows = shops as unknown as Row[];
    const shopIds = shopRows.map((s) => str(s['id']));

    const { data: contacts } = await this.sb
      .from('shop_contacts')
      .select('shop_id, mobile, is_primary')
      .in('shop_id', shopIds);
    const phoneMap = new Map<string, string>();
    for (const c of (contacts ?? []) as Row[]) {
      if (c['is_primary'] === true) {
        phoneMap.set(str(c['shop_id']), str(c['mobile']));
      }
    }

    const { data: areas } = await this.sb.from('service_areas').select('id, name');
    const areaMap = new Map(
      (areas ?? []).map((a) => [
        str((a as unknown as Row)['id']),
        str((a as unknown as Row)['name']),
      ]),
    );

    const { data: ordersData } = await this.sb
      .from('orders')
      .select('id, shop_id, status, total, created_at')
      .in('shop_id', shopIds);

    const orderRows = ((ordersData ?? []) as Row[]).filter(
      (o) => str(o['status']) !== 'CANCELLED',
    );
    const orderIds = orderRows.map((o) => str(o['id']));

    const { data: paymentsData } = orderIds.length
      ? await this.sb
          .from('payments')
          .select(
            'id, order_id, status, amount, cash_collected_amount, online_collected_amount, paid_at, created_at, collection_method, method_intent',
          )
          .in('order_id', orderIds)
      : { data: [] as Row[] };

    const paymentsByShop = new Map<
      string,
      {
        orders: {
          id: string;
          status: string;
          total: number;
          created_at: string;
          order_code: string;
        }[];
        payments: {
          id: string;
          order_id: string;
          status: string;
          amount: number;
          cash_collected_amount: number;
          online_collected_amount: number;
          paid_at: string | null;
          created_at: string | null;
          method_label: string | null;
        }[];
      }
    >();

    for (const sid of shopIds) {
      paymentsByShop.set(sid, { orders: [], payments: [] });
    }

    const orderShop = new Map<string, string>();
    for (const o of orderRows) {
      const oid = str(o['id']);
      const sid = str(o['shop_id']);
      orderShop.set(oid, sid);
      const bucket = paymentsByShop.get(sid);
      if (!bucket) continue;
      bucket.orders.push({
        id: oid,
        status: str(o['status']),
        total: num(o['total']),
        created_at: str(o['created_at']),
        order_code: shortCode(oid, 'GA'),
      });
    }

    for (const p of (paymentsData ?? []) as Row[]) {
      const oid = str(p['order_id']);
      const sid = orderShop.get(oid);
      if (!sid) continue;
      const bucket = paymentsByShop.get(sid);
      if (!bucket) continue;
      const collectionMethod = p['collection_method']
        ? str(p['collection_method'])
        : '';
      const methodIntent = p['method_intent'] ? str(p['method_intent']) : '';
      bucket.payments.push({
        id: str(p['id']),
        order_id: oid,
        status: str(p['status']),
        amount: num(p['amount']),
        cash_collected_amount: num(p['cash_collected_amount']),
        online_collected_amount: num(p['online_collected_amount']),
        paid_at: p['paid_at'] ? str(p['paid_at']) : null,
        created_at: p['created_at'] ? str(p['created_at']) : null,
        method_label: collectionMethod
          ? collectionMethodLabel(collectionMethod)
          : methodIntent === 'PAY_ONLINE_NOW'
            ? 'Online'
            : methodIntent === 'PAY_ON_DELIVERY'
              ? 'Pay on delivery'
              : null,
      });
    }

    return buildReceivablesSnapshot({
      generatedAtIso: new Date().toISOString(),
      customers: shopRows.map((s) => {
        const sid = str(s['id']);
        const bucket = paymentsByShop.get(sid) ?? { orders: [], payments: [] };
        return {
          customerId: sid,
          shopName: str(s['trade_name']),
          phoneLabel: phoneMap.get(sid) ?? '—',
          areaLabel: areaMap.get(str(s['service_area_id'])) ?? '—',
          orders: bucket.orders,
          payments: bucket.payments,
        };
      }),
    });
  }

  async companyExpensesSnapshot(): Promise<CompanyExpensesSnapshot> {
    const { data, error } = await this.sb
      .from('company_expenses')
      .select('*')
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throwRpcError(error, 'Could not load expenses');
    const rows = ((data ?? []) as Row[]).map((row) =>
      mapCompanyExpenseRow({
        id: str(row['id']),
        expense_date: str(row['expense_date']),
        category: str(row['category']),
        amount: num(row['amount']),
        description: str(row['description']),
        payment_method: str(row['payment_method']),
        reference_number: row['reference_number']
          ? str(row['reference_number'])
          : null,
        receipt_path: row['receipt_path'] ? str(row['receipt_path']) : null,
        created_at: str(row['created_at']),
        updated_at: str(row['updated_at']),
      }),
    );
    return buildCompanyExpensesSnapshot({
      generatedAtIso: new Date().toISOString(),
      rows,
    });
  }

  async companyExpenseDetail(id: string): Promise<CompanyExpenseRow | null> {
    const { data, error } = await this.sb
      .from('company_expenses')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throwRpcError(error, 'Could not load expense');
    if (!data) return null;
    const row = data as unknown as Row;
    return mapCompanyExpenseRow({
      id: str(row['id']),
      expense_date: str(row['expense_date']),
      category: str(row['category']),
      amount: num(row['amount']),
      description: str(row['description']),
      payment_method: str(row['payment_method']),
      reference_number: row['reference_number']
        ? str(row['reference_number'])
        : null,
      receipt_path: row['receipt_path'] ? str(row['receipt_path']) : null,
      created_at: str(row['created_at']),
      updated_at: str(row['updated_at']),
    });
  }

  async createCompanyExpense(input: CompanyExpenseInput): Promise<CompanyExpenseRow> {
    const { data, error } = await this.sb.rpc('admin_create_company_expense', {
      p_expense_date: input.expenseDate,
      p_category: input.category,
      p_amount: input.amount,
      p_description: input.description.trim(),
      p_payment_method: input.paymentMethod,
      p_reference_number: input.referenceNumber?.trim() || null,
      p_receipt_path: input.receiptPath?.trim() || null,
    });
    if (error) throwRpcError(error, 'Could not save expense');
    const row = data as unknown as Row;
    return mapCompanyExpenseRow({
      id: str(row['id']),
      expense_date: str(row['expense_date']),
      category: str(row['category']),
      amount: num(row['amount']),
      description: str(row['description']),
      payment_method: str(row['payment_method']),
      reference_number: row['reference_number']
        ? str(row['reference_number'])
        : null,
      receipt_path: row['receipt_path'] ? str(row['receipt_path']) : null,
      created_at: str(row['created_at']),
      updated_at: str(row['updated_at']),
    });
  }

  async updateCompanyExpense(
    id: string,
    input: CompanyExpenseInput,
  ): Promise<CompanyExpenseRow> {
    const { data, error } = await this.sb.rpc('admin_update_company_expense', {
      p_expense_id: id,
      p_expense_date: input.expenseDate,
      p_category: input.category,
      p_amount: input.amount,
      p_description: input.description.trim(),
      p_payment_method: input.paymentMethod,
      p_reference_number: input.referenceNumber?.trim() || null,
      p_receipt_path: input.receiptPath?.trim() || null,
    });
    if (error) throwRpcError(error, 'Could not update expense');
    const row = data as unknown as Row;
    return mapCompanyExpenseRow({
      id: str(row['id']),
      expense_date: str(row['expense_date']),
      category: str(row['category']),
      amount: num(row['amount']),
      description: str(row['description']),
      payment_method: str(row['payment_method']),
      reference_number: row['reference_number']
        ? str(row['reference_number'])
        : null,
      receipt_path: row['receipt_path'] ? str(row['receipt_path']) : null,
      created_at: str(row['created_at']),
      updated_at: str(row['updated_at']),
    });
  }

  async deleteCompanyExpense(id: string): Promise<void> {
    const { error } = await this.sb.rpc('admin_delete_company_expense', {
      p_expense_id: id,
    });
    if (error) throwRpcError(error, 'Could not delete expense');
  }

  // ─── Phase 5A — Suppliers + Purchasing ───────────────────────────────

  async suppliersList(): Promise<SupplierRow[]> {
    const { data, error } = await this.sb
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true });
    if (error) throwRpcError(error, 'Could not load suppliers');
    return ((data ?? []) as Row[]).map((row) =>
      mapSupplierDbRow({
        id: str(row['id']),
        name: str(row['name']),
        contact_person: row['contact_person']
          ? str(row['contact_person'])
          : null,
        mobile: row['mobile'] ? str(row['mobile']) : null,
        email: row['email'] ? str(row['email']) : null,
        address_line: row['address_line'] ? str(row['address_line']) : null,
        city: row['city'] ? str(row['city']) : null,
        state: row['state'] ? str(row['state']) : null,
        gstin: row['gstin'] ? str(row['gstin']) : null,
        notes: row['notes'] ? str(row['notes']) : null,
        is_active: row['is_active'] !== false,
        created_at: str(row['created_at']),
        updated_at: str(row['updated_at']),
      }),
    );
  }

  async listSupplierPayments(
    supplierId?: string,
  ): Promise<SupplierPaymentLedgerInput[]> {
    let query = this.sb
      .from('supplier_payments')
      .select(
        'id, supplier_id, purchase_id, payment_date, amount, payment_method, reference_number, notes, created_at',
      )
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (supplierId) query = query.eq('supplier_id', supplierId);
    const { data, error } = await query;
    if (error) throwRpcError(error, 'Could not load supplier payments');
    return ((data ?? []) as Row[]).map((row) => ({
      id: str(row['id']),
      supplierId: str(row['supplier_id']),
      purchaseId: row['purchase_id'] ? str(row['purchase_id']) : null,
      paymentDate: str(row['payment_date']),
      amount: num(row['amount']),
      paymentMethod: mapSupplierPaymentMethod(str(row['payment_method'])),
      referenceNumber: row['reference_number']
        ? str(row['reference_number'])
        : null,
      notes: row['notes'] ? str(row['notes']) : null,
      createdAt: row['created_at'] ? str(row['created_at']) : null,
    }));
  }

  async supplierPayablesSnapshot(): Promise<SupplierPayablesSnapshot> {
    const [suppliers, purchases, payments] = await Promise.all([
      this.suppliersList(),
      this.purchasesList(),
      this.listSupplierPayments(),
    ]);
    return buildSupplierPayablesSnapshot({
      generatedAtIso: new Date().toISOString(),
      suppliers: suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        contactPerson: s.contactPerson,
        mobileLabel: s.mobileLabel,
      })),
      purchases: purchases.map((p) => ({
        id: p.id,
        supplierId: p.supplierId,
        billNumber: p.billNumber,
        status: p.status,
        total: p.total,
        purchaseDate: p.purchaseDate,
      })),
      payments,
    });
  }

  /**
   * Phase 17 — rules-based dues Q&A over receivables + payables.
   * No LLM; ranking only. Confirm/collect/pay still happens on existing pages.
   */
  async duesAssistantSnapshot(): Promise<DuesAssistantSnapshot> {
    const [receivables, payables] = await Promise.all([
      this.receivablesSnapshot(),
      this.supplierPayablesSnapshot(),
    ]);
    return buildDuesAssistantSnapshot({
      generatedAtIso: new Date().toISOString(),
      receivables,
      payables,
    });
  }

  /**
   * Phase 18 — rules-based purchase suggestions from stock + sales velocity.
   * Never creates a purchase; owner confirms on Purchases → New.
   */
  async purchaseRecommendationsSnapshot(): Promise<PurchaseRecommendationsSnapshot> {
    const now = new Date();
    const lookbackStart = new Date(now.getTime() - SALES_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const fromYmd = ymdInBusinessTz(lookbackStart);
    const fromIso = businessDayStartIso(fromYmd);

    const inventory = await this.inventorySnapshot();

    const { data: salesData } = await this.sb
      .from('sales')
      .select('id, converted_at, status')
      .neq('status', 'REFUNDED')
      .gte('converted_at', fromIso)
      .limit(3000);
    const saleIds = ((salesData ?? []) as Row[])
      .filter((s) => str(s['status']) !== 'REFUNDED')
      .map((s) => str(s['id']));

    const soldBySku = new Map<string, number>();
    if (saleIds.length > 0) {
      const { data: items } = await this.sb
        .from('sale_items')
        .select('sku_id, quantity')
        .in('sale_id', saleIds);
      for (const item of (items ?? []) as Row[]) {
        const skuId = item['sku_id'] ? str(item['sku_id']) : '';
        if (!skuId) continue;
        soldBySku.set(
          skuId,
          (soldBySku.get(skuId) ?? 0) + num(item['quantity']),
        );
      }
    }

    const { data: purchaseRows } = await this.sb
      .from('purchases')
      .select('id, supplier_id, status, purchase_date, created_at')
      .in('status', ['DRAFT', 'RECEIVED'])
      .order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500);
    const purchases = (purchaseRows ?? []) as Row[];
    const purchaseIds = purchases.map((p) => str(p['id']));
    const purchaseMeta = new Map(
      purchases.map((p) => [
        str(p['id']),
        {
          supplierId: str(p['supplier_id']),
          status: str(p['status']).toUpperCase(),
          purchaseDate: str(p['purchase_date']),
          createdAt: str(p['created_at']),
        },
      ]),
    );

    const openDraftBySku = new Map<string, number>();
    const lastReceivedBySku = new Map<
      string,
      { supplierId: string; quantity: number; sortKey: string }
    >();

    if (purchaseIds.length > 0) {
      const { data: itemRows } = await this.sb
        .from('purchase_items')
        .select('purchase_id, sku_id, quantity')
        .in('purchase_id', purchaseIds);
      for (const item of (itemRows ?? []) as Row[]) {
        const purchaseId = str(item['purchase_id']);
        const skuId = str(item['sku_id']);
        const qty = num(item['quantity']);
        const meta = purchaseMeta.get(purchaseId);
        if (!meta || !skuId) continue;
        if (meta.status === 'DRAFT') {
          openDraftBySku.set(
            skuId,
            (openDraftBySku.get(skuId) ?? 0) + qty,
          );
        } else if (meta.status === 'RECEIVED') {
          const sortKey = `${meta.purchaseDate}|${meta.createdAt}|${purchaseId}`;
          const existing = lastReceivedBySku.get(skuId);
          if (!existing || sortKey > existing.sortKey) {
            lastReceivedBySku.set(skuId, {
              supplierId: meta.supplierId,
              quantity: qty,
              sortKey,
            });
          }
        }
      }
    }

    const supplierIds = [
      ...new Set(
        [...lastReceivedBySku.values()].map((v) => v.supplierId).filter(Boolean),
      ),
    ];
    const supplierNameById = new Map<string, string>();
    if (supplierIds.length > 0) {
      const { data: suppliers } = await this.sb
        .from('suppliers')
        .select('id, name')
        .in('id', supplierIds);
      for (const s of (suppliers ?? []) as Row[]) {
        supplierNameById.set(str(s['id']), str(s['name']));
      }
    }

    const signals: PurchaseSkuSignal[] = inventory.rows.map((row) => {
      const last = lastReceivedBySku.get(row.skuId);
      return inventoryRowToSignal(row, {
        soldLast28Days: soldBySku.get(row.skuId) ?? 0,
        openDraftQty: openDraftBySku.get(row.skuId) ?? 0,
        lastSupplierId: last?.supplierId ?? null,
        lastSupplierName: last
          ? supplierNameById.get(last.supplierId) ?? null
          : null,
        lastPurchaseQty: last?.quantity ?? null,
      });
    });

    return buildPurchaseRecommendationsSnapshot({
      generatedAtIso: now.toISOString(),
      signals,
    });
  }

  /**
   * Phase 19 — rules-based profit change + unusual flags.
   * Compares this month vs last month P&L from existing reports. Never labels fraud.
   */
  async profitAnomalyAssistantSnapshot(): Promise<ProfitAnomalyAssistantSnapshot> {
    const asOf = new Date();
    const toYmd = (d: Date | null): string => {
      if (!d) return ymdInBusinessTz(asOf);
      return ymdInBusinessTz(d);
    };

    const currentRange = dateRangeForPreset('this_month', undefined, asOf);
    const priorRange = dateRangeForPreset('last_month', undefined, asOf);
    const currentFrom = toYmd(currentRange.from);
    const currentTo = toYmd(currentRange.to);
    const priorFrom = toYmd(priorRange.from);
    const priorTo = toYmd(priorRange.to);

    const [currentSnap, priorSnap, expensesSnap] = await Promise.all([
      this.profitLossSnapshot({ dateFrom: currentFrom, dateTo: currentTo }),
      this.profitLossSnapshot({ dateFrom: priorFrom, dateTo: priorTo }),
      this.companyExpensesSnapshot(),
    ]);

    const currentExpenses = filterExpensesByDate(
      expensesSnap.rows,
      currentFrom,
      currentTo,
    );

    const currentWindow = businessDateRangeInclusive(currentFrom, currentTo);
    const { data: adjRows, error: adjErr } = await this.sb
      .from('inventory_movements')
      .select('movement_type')
      .in('movement_type', ['ADMIN_ADJUSTMENT', 'DAMAGE'])
      .gte('created_at', currentWindow.fromIso)
      .lt('created_at', currentWindow.toIsoExclusive)
      .limit(2000);
    if (adjErr) {
      throwRpcError(adjErr, 'Could not load stock adjustments for insights');
    }

    let adjustmentCount = 0;
    let damageCount = 0;
    for (const row of (adjRows ?? []) as Row[]) {
      const type = str(row['movement_type']).toUpperCase();
      if (type === 'ADMIN_ADJUSTMENT') adjustmentCount += 1;
      else if (type === 'DAMAGE') damageCount += 1;
    }

    return buildProfitAnomalyAssistantSnapshot({
      generatedAtIso: asOf.toISOString(),
      currentLabel: 'This month',
      priorLabel: 'Last month',
      currentRangeLabel: currentSnap.rangeLabel || currentRange.label,
      priorRangeLabel: priorSnap.rangeLabel || priorRange.label,
      current: currentSnap.profitLoss,
      prior: priorSnap.profitLoss,
      expenses: currentExpenses.map((row) => ({
        id: row.id,
        amount: row.amount,
        amountLabel: row.amountLabel,
        categoryLabel: row.categoryLabel,
        description: row.description,
        expenseDateLabel: row.expenseDateLabel,
        href: `/expenses/${row.id}`,
      })),
      stock: { adjustmentCount, damageCount },
    });
  }

  /**
   * Phase 20 — rules-based daily business brief (yesterday + attention + recs).
   * Configurable sections; never invents narrative beyond ranked facts.
   */
  async dailyBusinessBriefSnapshot(): Promise<DailyBusinessBriefSnapshot> {
    const asOf = new Date();
    const hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        hour12: false,
      }).format(asOf),
    );
    const yesterdayRange = dateRangeForPreset('yesterday', undefined, asOf);
    const toYmd = (d: Date | null): string =>
      d ? ymdInBusinessTz(d) : ymdInBusinessTz(asOf);
    const yFrom = toYmd(yesterdayRange.from);
    const yTo = toYmd(yesterdayRange.to);

    const [
      plSnap,
      receivables,
      payables,
      balancesRes,
      purchasesRes,
      billScansRes,
      purchaseRecs,
      profitInsights,
    ] = await Promise.all([
      this.profitLossSnapshot({ dateFrom: yFrom, dateTo: yTo }),
      this.receivablesSnapshot(),
      this.supplierPayablesSnapshot(),
      this.sb.from('inventory_balances').select('available_quantity'),
      this.sb.from('purchases').select('id, status'),
      this.sb
        .from('purchase_bill_scans')
        .select('id, status')
        .in('status', ['UPLOADED', 'REVIEWING']),
      this.purchaseRecommendationsSnapshot().catch(() => null),
      this.profitAnomalyAssistantSnapshot().catch(() => null),
    ]);

    if (balancesRes.error) {
      throwRpcError(balancesRes.error, 'Could not load stock for daily brief');
    }
    if (purchasesRes.error) {
      throwRpcError(purchasesRes.error, 'Could not load purchases for daily brief');
    }
    // Bill scans table may be missing until hosted migration — treat as zero.
    const billScans = billScansRes.error
      ? []
      : ((billScansRes.data ?? []) as Row[]);

    const balances = (balancesRes.data ?? []) as Row[];
    const purchases = (purchasesRes.data ?? []) as Row[];
    const lowStockThreshold = 10;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    for (const b of balances) {
      const avail = num(b['available_quantity']);
      if (avail <= 0) outOfStockCount += 1;
      else if (avail < lowStockThreshold) lowStockCount += 1;
    }

    const draftPurchaseCount = purchases.filter(
      (p) => str(p['status']).toUpperCase() === 'DRAFT',
    ).length;

    const customersDue = receivables.rows.filter((r) => r.outstanding > 0);
    const staleCustomers = customersDue.filter(
      (r) =>
        r.ageingBucket === 'days_61_plus' || (r.oldestOpenDays ?? 0) >= 61,
    ).length;

    const topPurchase = purchaseRecs?.rows[0]
      ? {
          productName: purchaseRecs.rows[0].productName,
          recommendedQtyLabel: purchaseRecs.rows[0].recommendedQtyLabel,
          purchaseHref: purchaseRecs.rows[0].purchaseHref,
        }
      : null;

    const unusualExpense =
      profitInsights?.answers.what_looks_unusual.findings.find(
        (f) =>
          f.id === 'expense-spike' ||
          f.id.startsWith('expense-') ||
          f.id === 'margin-drop',
      ) ?? null;

    return buildDailyBusinessBriefSnapshot({
      generatedAtIso: asOf.toISOString(),
      hour: Number.isFinite(hour) ? hour : asOf.getHours(),
      yesterdayDateLabel: formatDate(
        yesterdayRange.from?.toISOString() ?? asOf.toISOString(),
      ),
      asOfLabel: formatDate(asOf.toISOString()),
      profitLossYesterday: plSnap.profitLoss,
      yesterdayRangeLabel: plSnap.rangeLabel || yesterdayRange.label,
      customersWithDues: customersDue.length,
      staleCustomers,
      suppliersWithDues: payables.suppliersWithDues,
      lowStockCount,
      outOfStockCount,
      draftPurchaseCount,
      billScansPendingCount: billScans.length,
      customers: customersDue.map((r) => ({
        customerId: r.customerId,
        shopName: r.shopName,
        outstanding: r.outstanding,
        outstandingLabel: r.outstandingLabel,
        oldestOpenDays: r.oldestOpenDays,
        ageingBucket: r.ageingBucket,
        ledgerHref: r.ledgerHref,
      })),
      suppliers: payables.rows
        .filter((r) => r.outstanding > 0)
        .map((r) => ({
          supplierId: r.supplierId,
          supplierName: r.supplierName,
          outstanding: r.outstanding,
          outstandingLabel: r.outstandingLabel,
          payHref: r.payHref,
        })),
      topPurchase,
      unusualExpenseNote: unusualExpense
        ? `${unusualExpense.title}: ${unusualExpense.detail}`
        : null,
    });
  }

  async supplierDetail(id: string): Promise<{
    supplier: SupplierRow;
    purchases: PurchaseListRow[];
    ledger: SupplierLedgerVm;
    payments: Array<
      SupplierPaymentLedgerInput & {
        amountLabel: string;
        paymentMethodLabel: string;
        paymentDateLabel: string;
      }
    >;
  } | null> {
    const { data, error } = await this.sb
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throwRpcError(error, 'Could not load supplier');
    if (!data) return null;
    const row = data as unknown as Row;
    const supplier = mapSupplierDbRow({
      id: str(row['id']),
      name: str(row['name']),
      contact_person: row['contact_person']
        ? str(row['contact_person'])
        : null,
      mobile: row['mobile'] ? str(row['mobile']) : null,
      email: row['email'] ? str(row['email']) : null,
      address_line: row['address_line'] ? str(row['address_line']) : null,
      city: row['city'] ? str(row['city']) : null,
      state: row['state'] ? str(row['state']) : null,
      gstin: row['gstin'] ? str(row['gstin']) : null,
      notes: row['notes'] ? str(row['notes']) : null,
      is_active: row['is_active'] !== false,
      created_at: str(row['created_at']),
      updated_at: str(row['updated_at']),
    });
    const purchases = (await this.purchasesList()).filter(
      (p) => p.supplierId === id,
    );
    const payments = await this.listSupplierPayments(id);
    const ledger = buildSupplierLedger({
      supplierId: id,
      purchases: purchases.map((p) => ({
        id: p.id,
        supplierId: p.supplierId,
        billNumber: p.billNumber,
        status: p.status,
        total: p.total,
        purchaseDate: p.purchaseDate,
      })),
      payments,
    });
    return {
      supplier,
      purchases,
      ledger,
      payments: payments.map((payment) => ({
        ...payment,
        amountLabel: formatInr(payment.amount),
        paymentMethodLabel:
          SUPPLIER_PAYMENT_METHOD_LABELS[
            mapSupplierPaymentMethod(payment.paymentMethod)
          ],
        paymentDateLabel: formatDate(payment.paymentDate),
      })),
    };
  }

  async recordSupplierPayment(input: {
    supplierId: string;
    paymentDate: string;
    amount: number;
    paymentMethod: SupplierPaymentMethod;
    referenceNumber?: string | null;
    notes?: string | null;
    purchaseId?: string | null;
  }): Promise<SupplierPaymentLedgerInput> {
    const { data, error } = await this.sb.rpc('admin_record_supplier_payment', {
      p_supplier_id: input.supplierId,
      p_payment_date: input.paymentDate,
      p_amount: input.amount,
      p_payment_method: input.paymentMethod,
      p_reference_number: input.referenceNumber?.trim() || null,
      p_notes: input.notes?.trim() || null,
      p_purchase_id: input.purchaseId || null,
    });
    if (error) throwRpcError(error, 'Could not record supplier payment');
    const row = data as unknown as Row;
    return {
      id: str(row['id']),
      supplierId: str(row['supplier_id']),
      purchaseId: row['purchase_id'] ? str(row['purchase_id']) : null,
      paymentDate: str(row['payment_date']),
      amount: num(row['amount']),
      paymentMethod: mapSupplierPaymentMethod(str(row['payment_method'])),
      referenceNumber: row['reference_number']
        ? str(row['reference_number'])
        : null,
      notes: row['notes'] ? str(row['notes']) : null,
      createdAt: row['created_at'] ? str(row['created_at']) : null,
    };
  }

  async deleteSupplierPayment(paymentId: string): Promise<void> {
    const { error } = await this.sb.rpc('admin_delete_supplier_payment', {
      p_payment_id: paymentId,
    });
    if (error) throwRpcError(error, 'Could not delete supplier payment');
  }

  async createSupplier(input: SupplierInput): Promise<SupplierRow> {
    const { data, error } = await this.sb.rpc('admin_create_supplier', {
      p_name: input.name.trim(),
      p_contact_person: input.contactPerson?.trim() || null,
      p_mobile: input.mobile?.trim() || null,
      p_email: input.email?.trim() || null,
      p_address_line: input.addressLine?.trim() || null,
      p_city: input.city?.trim() || null,
      p_state: input.state?.trim() || null,
      p_gstin: input.gstin?.trim() || null,
      p_notes: input.notes?.trim() || null,
      p_is_active: input.isActive ?? true,
    });
    if (error) throwRpcError(error, 'Could not create supplier');
    const row = data as unknown as Row;
    return mapSupplierDbRow({
      id: str(row['id']),
      name: str(row['name']),
      contact_person: row['contact_person']
        ? str(row['contact_person'])
        : null,
      mobile: row['mobile'] ? str(row['mobile']) : null,
      email: row['email'] ? str(row['email']) : null,
      address_line: row['address_line'] ? str(row['address_line']) : null,
      city: row['city'] ? str(row['city']) : null,
      state: row['state'] ? str(row['state']) : null,
      gstin: row['gstin'] ? str(row['gstin']) : null,
      notes: row['notes'] ? str(row['notes']) : null,
      is_active: row['is_active'] !== false,
      created_at: str(row['created_at']),
      updated_at: str(row['updated_at']),
    });
  }

  async updateSupplier(id: string, input: SupplierInput): Promise<SupplierRow> {
    const { data, error } = await this.sb.rpc('admin_update_supplier', {
      p_supplier_id: id,
      p_name: input.name.trim(),
      p_contact_person: input.contactPerson?.trim() || null,
      p_mobile: input.mobile?.trim() || null,
      p_email: input.email?.trim() || null,
      p_address_line: input.addressLine?.trim() || null,
      p_city: input.city?.trim() || null,
      p_state: input.state?.trim() || null,
      p_gstin: input.gstin?.trim() || null,
      p_notes: input.notes?.trim() || null,
      p_is_active: input.isActive ?? true,
    });
    if (error) throwRpcError(error, 'Could not update supplier');
    const row = data as unknown as Row;
    return mapSupplierDbRow({
      id: str(row['id']),
      name: str(row['name']),
      contact_person: row['contact_person']
        ? str(row['contact_person'])
        : null,
      mobile: row['mobile'] ? str(row['mobile']) : null,
      email: row['email'] ? str(row['email']) : null,
      address_line: row['address_line'] ? str(row['address_line']) : null,
      city: row['city'] ? str(row['city']) : null,
      state: row['state'] ? str(row['state']) : null,
      gstin: row['gstin'] ? str(row['gstin']) : null,
      notes: row['notes'] ? str(row['notes']) : null,
      is_active: row['is_active'] !== false,
      created_at: str(row['created_at']),
      updated_at: str(row['updated_at']),
    });
  }

  async purchasesList(): Promise<PurchaseListRow[]> {
    const { data, error } = await this.sb
      .from('purchases')
      .select('*')
      .order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throwRpcError(error, 'Could not load purchases');

    const purchaseRows = (data ?? []) as Row[];
    if (purchaseRows.length === 0) return [];

    const purchaseIds = purchaseRows.map((p) => str(p['id']));
    const supplierIds = [
      ...new Set(purchaseRows.map((p) => str(p['supplier_id']))),
    ];
    const locationIds = [
      ...new Set(purchaseRows.map((p) => str(p['operational_location_id']))),
    ];

    const [suppliersRes, locationsRes, itemsRes] = await Promise.all([
      this.sb.from('suppliers').select('id, name').in('id', supplierIds),
      this.sb
        .from('operational_locations')
        .select('id, name')
        .in('id', locationIds),
      this.sb
        .from('purchase_items')
        .select('purchase_id')
        .in('purchase_id', purchaseIds),
    ]);
    if (suppliersRes.error) {
      throwRpcError(suppliersRes.error, 'Could not load purchase suppliers');
    }
    if (locationsRes.error) {
      throwRpcError(locationsRes.error, 'Could not load purchase warehouses');
    }
    if (itemsRes.error) {
      throwRpcError(itemsRes.error, 'Could not load purchase items');
    }

    const supplierMap = new Map(
      ((suppliersRes.data ?? []) as Row[]).map((s) => [
        str(s['id']),
        str(s['name']),
      ]),
    );
    const locationMap = new Map(
      ((locationsRes.data ?? []) as Row[]).map((l) => [
        str(l['id']),
        str(l['name']),
      ]),
    );
    const itemCount = new Map<string, number>();
    for (const item of (itemsRes.data ?? []) as Row[]) {
      const pid = str(item['purchase_id']);
      itemCount.set(pid, (itemCount.get(pid) ?? 0) + 1);
    }

    return purchaseRows.map((p) => {
      const id = str(p['id']);
      return mapPurchaseListFields({
        id,
        supplierId: str(p['supplier_id']),
        supplierName: supplierMap.get(str(p['supplier_id'])) ?? '—',
        warehouseId: str(p['operational_location_id']),
        warehouseName:
          locationMap.get(str(p['operational_location_id'])) ?? '—',
        purchaseDate: str(p['purchase_date']),
        billNumber: str(p['bill_number']),
        status: str(p['status']),
        itemCount: itemCount.get(id) ?? 0,
        subtotal: num(p['subtotal']),
        taxAmount: num(p['tax_amount']),
        cgstAmount: num(p['cgst_amount']),
        sgstAmount: num(p['sgst_amount']),
        igstAmount: num(p['igst_amount']),
        supplyType: str(p['supply_type']) || 'UNSET',
        total: num(p['total']),
      });
    });
  }

  async purchaseDetail(id: string): Promise<PurchaseDetail | null> {
    const { data, error } = await this.sb
      .from('purchases')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throwRpcError(error, 'Could not load purchase');
    if (!data) return null;
    const p = data as unknown as Row;

    const [supplierRes, locationRes, itemsRes, paymentsRes] = await Promise.all([
      this.sb
        .from('suppliers')
        .select('id, name')
        .eq('id', str(p['supplier_id']))
        .maybeSingle(),
      this.sb
        .from('operational_locations')
        .select('id, name')
        .eq('id', str(p['operational_location_id']))
        .maybeSingle(),
      this.sb
        .from('purchase_items')
        .select('*')
        .eq('purchase_id', id)
        .order('created_at', { ascending: true }),
      this.sb
        .from('supplier_payments')
        .select(
          'id, payment_date, amount, payment_method, reference_number, created_at',
        )
        .eq('purchase_id', id)
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false }),
    ]);
    if (supplierRes.error) {
      throwRpcError(supplierRes.error, 'Could not load purchase supplier');
    }
    if (locationRes.error) {
      throwRpcError(locationRes.error, 'Could not load purchase warehouse');
    }
    if (itemsRes.error) {
      throwRpcError(itemsRes.error, 'Could not load purchase lines');
    }
    if (paymentsRes.error) {
      throwRpcError(paymentsRes.error, 'Could not load bill payments');
    }

    const items = ((itemsRes.data ?? []) as Row[]).map((row) =>
      mapPurchaseItemDbRow({
        id: str(row['id']),
        sku_id: str(row['sku_id']),
        product_name: str(row['product_name']),
        sku_code: str(row['sku_code']),
        sku_name: str(row['sku_name']),
        quantity: num(row['quantity']),
        unit_cost: num(row['unit_cost']),
        line_total: num(row['line_total']),
      }),
    );

    const billPayments = ((paymentsRes.data ?? []) as Row[]).map((row) => {
      const method = mapSupplierPaymentMethod(str(row['payment_method']));
      return {
        id: str(row['id']),
        paymentDate: str(row['payment_date']),
        paymentDateLabel: formatDate(str(row['payment_date'])),
        amount: num(row['amount']),
        amountLabel: formatInr(num(row['amount'])),
        paymentMethod: method,
        paymentMethodLabel: SUPPLIER_PAYMENT_METHOD_LABELS[method],
        referenceNumber: row['reference_number']
          ? str(row['reference_number'])
          : null,
      };
    });

    const list = mapPurchaseListFields({
      id: str(p['id']),
      supplierId: str(p['supplier_id']),
      supplierName: supplierRes.data
        ? str((supplierRes.data as unknown as Row)['name'])
        : '—',
      warehouseId: str(p['operational_location_id']),
      warehouseName: locationRes.data
        ? str((locationRes.data as unknown as Row)['name'])
        : '—',
      purchaseDate: str(p['purchase_date']),
      billNumber: str(p['bill_number']),
      status: str(p['status']),
      itemCount: items.length,
      subtotal: num(p['subtotal']),
      taxAmount: num(p['tax_amount']),
      cgstAmount: num(p['cgst_amount']),
      sgstAmount: num(p['sgst_amount']),
      igstAmount: num(p['igst_amount']),
      supplyType: str(p['supply_type']) || 'UNSET',
      total: num(p['total']),
    });

    const status = list.status;
    const accounting = buildPurchaseAccounting({
      status,
      subtotal: list.subtotal,
      taxAmount: list.taxAmount,
      total: list.total,
      items,
      payments: billPayments.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        paymentDate: payment.paymentDate,
        paymentMethodLabel: payment.paymentMethodLabel,
        referenceNumber: payment.referenceNumber,
      })),
    });

    return {
      ...list,
      notes: p['notes'] ? str(p['notes']) : null,
      receivedAtLabel: p['received_at']
        ? formatDateTime(str(p['received_at']))
        : null,
      items,
      subtotalLabel: formatInr(list.subtotal),
      taxAmountLabel: formatInr(list.taxAmount),
      canEdit: status === 'DRAFT',
      canReceive: status === 'DRAFT' && items.length > 0,
      accounting,
      billPayments,
    };
  }

  async upsertPurchaseDraft(input: PurchaseDraftInput): Promise<PurchaseDetail> {
    const { data, error } = await this.sb.rpc('admin_upsert_purchase_draft', {
      p_purchase_id: input.purchaseId ?? null,
      p_supplier_id: input.supplierId,
      p_operational_location_id: input.warehouseId,
      p_purchase_date: input.purchaseDate.slice(0, 10),
      p_bill_number: input.billNumber.trim(),
      p_tax_amount: input.taxAmount ?? 0,
      p_notes: input.notes?.trim() || null,
      p_items: input.items.map((item) => ({
        sku_id: item.skuId,
        quantity: item.quantity,
        unit_cost: item.unitCost,
      })),
      p_supply_type: input.supplyType ?? 'UNSET',
      p_cgst_amount: input.cgstAmount ?? 0,
      p_sgst_amount: input.sgstAmount ?? 0,
      p_igst_amount: input.igstAmount ?? 0,
    });
    if (error) throwRpcError(error, 'Could not save purchase');
    const row = data as unknown as Row;
    const detail = await this.purchaseDetail(str(row['id']));
    if (!detail) throw new Error('Purchase saved but could not be reloaded');
    return detail;
  }

  async receivePurchase(purchaseId: string): Promise<{
    purchaseId: string;
    status: PurchaseStatus;
    alreadyReceived: boolean;
    movementCount: number;
    totalQuantity: number;
  }> {
    const { data, error } = await this.sb.rpc('admin_receive_purchase', {
      p_purchase_id: purchaseId,
    });
    if (error) throwRpcError(error, 'Could not receive purchase');
    const row = data as unknown as Row;
    return {
      purchaseId: str(row['purchaseId'] ?? purchaseId),
      status: (str(row['status']).toUpperCase() as PurchaseStatus) || 'RECEIVED',
      alreadyReceived: row['alreadyReceived'] === true,
      movementCount: num(row['movementCount']),
      totalQuantity: num(row['totalQuantity']),
    };
  }

  async cancelPurchaseDraft(purchaseId: string): Promise<PurchaseDetail> {
    const { data, error } = await this.sb.rpc('admin_cancel_purchase_draft', {
      p_purchase_id: purchaseId,
    });
    if (error) throwRpcError(error, 'Could not cancel purchase');
    const row = data as unknown as Row;
    const detail = await this.purchaseDetail(str(row['id']));
    if (!detail) throw new Error('Purchase cancelled but could not be reloaded');
    return detail;
  }

  /** Phase 13: create an empty bill scan row (admin only). */
  async createPurchaseBillScan(notes?: string | null): Promise<PurchaseBillScanVm> {
    const { data, error } = await this.sb.rpc('admin_create_purchase_bill_scan', {
      p_notes: notes?.trim() || null,
    });
    if (error) throwRpcError(error, 'Could not create bill scan');
    return this.mapPurchaseBillScan(data as unknown as Row);
  }

  async getPurchaseBillScan(scanId: string): Promise<PurchaseBillScanVm | null> {
    const { data, error } = await this.sb
      .from('purchase_bill_scans')
      .select(
        'id, status, image_path, extract_json, extractor_label, purchase_id, notes, created_at',
      )
      .eq('id', scanId)
      .maybeSingle();
    if (error) throwRpcError(error, 'Could not load bill scan');
    if (!data) return null;
    return this.mapPurchaseBillScan(data as unknown as Row);
  }

  async uploadPurchaseBillScanImage(
    scanId: string,
    file: { bytes: Blob | ArrayBuffer | Uint8Array; contentType: string },
  ): Promise<PurchaseBillScanVm> {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(file.contentType)) {
      throw new Error('Use a JPEG, PNG, or WebP photo.');
    }
    const ext =
      file.contentType === 'image/png'
        ? 'png'
        : file.contentType === 'image/webp'
          ? 'webp'
          : 'jpg';
    const path = `${scanId}/bill.${ext}`;
    const { error: uploadError } = await this.sb.storage
      .from('purchase-bills')
      .upload(path, file.bytes, {
        contentType: file.contentType,
        upsert: true,
      });
    if (uploadError) {
      throw new Error(uploadError.message || 'Could not upload bill photo');
    }
    const { data, error } = await this.sb.rpc(
      'admin_set_purchase_bill_scan_image',
      {
        p_scan_id: scanId,
        p_image_path: path,
      },
    );
    if (error) throwRpcError(error, 'Could not attach bill photo');
    return this.mapPurchaseBillScan(data as unknown as Row);
  }

  async savePurchaseBillScanExtract(
    scanId: string,
    extract: BillExtractDraft,
  ): Promise<PurchaseBillScanVm> {
    const { data, error } = await this.sb.rpc(
      'admin_save_purchase_bill_scan_extract',
      {
        p_scan_id: scanId,
        p_extract_json: extract,
        p_extractor_label: extract.extractorLabel || 'manual',
      },
    );
    if (error) throwRpcError(error, 'Could not save bill extract');
    return this.mapPurchaseBillScan(data as unknown as Row);
  }

  /**
   * Confirm path: create purchase DRAFT from reviewed extract, then mark scan confirmed.
   * Never receives stock.
   */
  async confirmPurchaseBillScanToDraft(input: {
    scanId: string;
    draft: PurchaseDraftInput;
  }): Promise<{ scan: PurchaseBillScanVm; purchase: PurchaseDetail }> {
    if (!input.draft.supplierId) {
      throw new Error('Choose a supplier before creating the draft');
    }
    if (!input.draft.warehouseId) {
      throw new Error('Choose a warehouse before creating the draft');
    }
    if (!input.draft.billNumber.trim()) {
      throw new Error('Bill number is required');
    }
    if (!input.draft.items.length) {
      throw new Error('Add at least one line with a matched SKU');
    }
    for (const item of input.draft.items) {
      if (!item.skuId || item.quantity <= 0 || item.unitCost < 0) {
        throw new Error('Each line needs SKU, positive quantity, and unit cost');
      }
    }

    const purchase = await this.upsertPurchaseDraft(input.draft);
    const { data, error } = await this.sb.rpc('admin_confirm_purchase_bill_scan', {
      p_scan_id: input.scanId,
      p_purchase_id: purchase.id,
    });
    if (error) throwRpcError(error, 'Could not confirm bill scan');
    const scan = await this.mapPurchaseBillScan(data as unknown as Row);
    return { scan, purchase };
  }

  async discardPurchaseBillScan(scanId: string): Promise<void> {
    const { error } = await this.sb.rpc('admin_discard_purchase_bill_scan', {
      p_scan_id: scanId,
    });
    if (error) throwRpcError(error, 'Could not discard bill scan');
  }

  private async mapPurchaseBillScan(row: Row): Promise<PurchaseBillScanVm> {
    const imagePath = row['imagePath']
      ? str(row['imagePath'])
      : row['image_path']
        ? str(row['image_path'])
        : null;
    let imageUrl: string | null = null;
    if (imagePath) {
      const signed = await this.sb.storage
        .from('purchase-bills')
        .createSignedUrl(imagePath, 60 * 60);
      if (!signed.error) imageUrl = signed.data?.signedUrl ?? null;
    }
    const extractRaw =
      row['extractJson'] ?? row['extract_json'] ?? {};
    const extract = parseBillExtractJson(extractRaw);
    const statusRaw = str(row['status'] ?? 'UPLOADED').toUpperCase();
    const status: PurchaseBillScanStatus =
      statusRaw === 'REVIEWING' ||
      statusRaw === 'CONFIRMED' ||
      statusRaw === 'DISCARDED' ||
      statusRaw === 'UPLOADED'
        ? statusRaw
        : 'UPLOADED';
    return {
      id: str(row['id']),
      status,
      imagePath,
      imageUrl,
      extract,
      extractorLabel: str(
        row['extractorLabel'] ?? row['extractor_label'] ?? extract.extractorLabel,
      ),
      purchaseId: row['purchaseId']
        ? str(row['purchaseId'])
        : row['purchase_id']
          ? str(row['purchase_id'])
          : null,
      notes: row['notes'] ? str(row['notes']) : null,
      createdAtLabel: row['createdAt']
        ? formatDateTime(str(row['createdAt']))
        : row['created_at']
          ? formatDateTime(str(row['created_at']))
          : '—',
    };
  }

  /** Phase 14: create an empty expense receipt scan row (admin only). */
  async createExpenseReceiptScan(notes?: string | null): Promise<ExpenseReceiptScanVm> {
    const { data, error } = await this.sb.rpc('admin_create_expense_receipt_scan', {
      p_notes: notes?.trim() || null,
    });
    if (error) throwRpcError(error, 'Could not create receipt scan');
    return this.mapExpenseReceiptScan(data as unknown as Row);
  }

  async getExpenseReceiptScan(scanId: string): Promise<ExpenseReceiptScanVm | null> {
    const { data, error } = await this.sb
      .from('expense_receipt_scans')
      .select(
        'id, status, image_path, extract_json, extractor_label, expense_id, notes, created_at',
      )
      .eq('id', scanId)
      .maybeSingle();
    if (error) throwRpcError(error, 'Could not load receipt scan');
    if (!data) return null;
    return this.mapExpenseReceiptScan(data as unknown as Row);
  }

  async uploadExpenseReceiptScanImage(
    scanId: string,
    file: { bytes: Blob | ArrayBuffer | Uint8Array; contentType: string },
  ): Promise<ExpenseReceiptScanVm> {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(file.contentType)) {
      throw new Error('Use a JPEG, PNG, or WebP photo.');
    }
    const ext =
      file.contentType === 'image/png'
        ? 'png'
        : file.contentType === 'image/webp'
          ? 'webp'
          : 'jpg';
    const path = `${scanId}/receipt.${ext}`;
    const { error: uploadError } = await this.sb.storage
      .from('expense-receipts')
      .upload(path, file.bytes, {
        contentType: file.contentType,
        upsert: true,
      });
    if (uploadError) {
      throw new Error(uploadError.message || 'Could not upload receipt photo');
    }
    const { data, error } = await this.sb.rpc(
      'admin_set_expense_receipt_scan_image',
      {
        p_scan_id: scanId,
        p_image_path: path,
      },
    );
    if (error) throwRpcError(error, 'Could not attach receipt photo');
    return this.mapExpenseReceiptScan(data as unknown as Row);
  }

  async saveExpenseReceiptScanExtract(
    scanId: string,
    extract: ReceiptExtractDraft,
  ): Promise<ExpenseReceiptScanVm> {
    const { data, error } = await this.sb.rpc(
      'admin_save_expense_receipt_scan_extract',
      {
        p_scan_id: scanId,
        p_extract_json: extract,
        p_extractor_label: extract.extractorLabel || 'manual',
      },
    );
    if (error) throwRpcError(error, 'Could not save receipt extract');
    return this.mapExpenseReceiptScan(data as unknown as Row);
  }

  /**
   * Confirm path: create company expense from reviewed extract, then mark scan confirmed.
   * Never auto-posts without owner review.
   */
  async confirmExpenseReceiptScanToExpense(input: {
    scanId: string;
    expense: CompanyExpenseInput;
  }): Promise<{ scan: ExpenseReceiptScanVm; expense: CompanyExpenseRow }> {
    const problem = validateCompanyExpenseInput(input.expense);
    if (problem) throw new Error(problem);

    const expense = await this.createCompanyExpense({
      ...input.expense,
      receiptPath: input.expense.receiptPath ?? null,
    });
    const { data, error } = await this.sb.rpc(
      'admin_confirm_expense_receipt_scan',
      {
        p_scan_id: input.scanId,
        p_expense_id: expense.id,
      },
    );
    if (error) throwRpcError(error, 'Could not confirm receipt scan');
    const scan = await this.mapExpenseReceiptScan(data as unknown as Row);
    return { scan, expense };
  }

  async discardExpenseReceiptScan(scanId: string): Promise<void> {
    const { error } = await this.sb.rpc('admin_discard_expense_receipt_scan', {
      p_scan_id: scanId,
    });
    if (error) throwRpcError(error, 'Could not discard receipt scan');
  }

  private async mapExpenseReceiptScan(row: Row): Promise<ExpenseReceiptScanVm> {
    const imagePath = row['imagePath']
      ? str(row['imagePath'])
      : row['image_path']
        ? str(row['image_path'])
        : null;
    let imageUrl: string | null = null;
    if (imagePath) {
      const signed = await this.sb.storage
        .from('expense-receipts')
        .createSignedUrl(imagePath, 60 * 60);
      if (!signed.error) imageUrl = signed.data?.signedUrl ?? null;
    }
    const extractRaw = row['extractJson'] ?? row['extract_json'] ?? {};
    const extract = parseReceiptExtractJson(extractRaw);
    const statusRaw = str(row['status'] ?? 'UPLOADED').toUpperCase();
    const status: ExpenseReceiptScanStatus =
      statusRaw === 'REVIEWING' ||
      statusRaw === 'CONFIRMED' ||
      statusRaw === 'DISCARDED' ||
      statusRaw === 'UPLOADED'
        ? statusRaw
        : 'UPLOADED';
    return {
      id: str(row['id']),
      status,
      imagePath,
      imageUrl,
      extract,
      extractorLabel: str(
        row['extractorLabel'] ?? row['extractor_label'] ?? extract.extractorLabel,
      ),
      expenseId: row['expenseId']
        ? str(row['expenseId'])
        : row['expense_id']
          ? str(row['expense_id'])
          : null,
      notes: row['notes'] ? str(row['notes']) : null,
      createdAtLabel: row['createdAt']
        ? formatDateTime(str(row['createdAt']))
        : row['created_at']
          ? formatDateTime(str(row['created_at']))
          : '—',
    };
  }

  /** Phase 15: create a day-book / rojnama scan from pasted text (admin only). */
  async createDayBookScan(input?: {
    sourceText?: string | null;
    notes?: string | null;
  }): Promise<DayBookScanVm> {
    const { data, error } = await this.sb.rpc('admin_create_day_book_scan', {
      p_source_text: input?.sourceText?.trim() || null,
      p_notes: input?.notes?.trim() || null,
    });
    if (error) throwRpcError(error, 'Could not create day book scan');
    return this.mapDayBookScan(data as unknown as Row);
  }

  async getDayBookScan(scanId: string): Promise<DayBookScanVm | null> {
    const { data, error } = await this.sb
      .from('day_book_scans')
      .select(
        'id, status, image_path, source_text, extract_json, extractor_label, notes, created_at',
      )
      .eq('id', scanId)
      .maybeSingle();
    if (error) throwRpcError(error, 'Could not load day book scan');
    if (!data) return null;
    return this.mapDayBookScan(data as unknown as Row);
  }

  async uploadDayBookScanImage(
    scanId: string,
    file: { bytes: Blob | ArrayBuffer | Uint8Array; contentType: string },
  ): Promise<DayBookScanVm> {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(file.contentType)) {
      throw new Error('Use a JPEG, PNG, or WebP photo.');
    }
    const ext =
      file.contentType === 'image/png'
        ? 'png'
        : file.contentType === 'image/webp'
          ? 'webp'
          : 'jpg';
    const path = `${scanId}/rojnama.${ext}`;
    const { error: uploadError } = await this.sb.storage
      .from('day-book-scans')
      .upload(path, file.bytes, {
        contentType: file.contentType,
        upsert: true,
      });
    if (uploadError) {
      throw new Error(uploadError.message || 'Could not upload day book photo');
    }
    const { data, error } = await this.sb.rpc('admin_set_day_book_scan_image', {
      p_scan_id: scanId,
      p_image_path: path,
    });
    if (error) throwRpcError(error, 'Could not attach day book photo');
    return this.mapDayBookScan(data as unknown as Row);
  }

  async saveDayBookScanExtract(
    scanId: string,
    extract: DayBookExtractDraft,
    sourceText?: string | null,
  ): Promise<DayBookScanVm> {
    const { data, error } = await this.sb.rpc(
      'admin_save_day_book_scan_extract',
      {
        p_scan_id: scanId,
        p_extract_json: extract,
        p_extractor_label: extract.extractorLabel || 'line-rules',
        p_source_text: sourceText ?? null,
      },
    );
    if (error) throwRpcError(error, 'Could not save day book extract');
    return this.mapDayBookScan(data as unknown as Row);
  }

  /**
   * Confirm path: create expenses / supplier payments for included lines only.
   * Collection lines stay as needs_order proposals — never silent collection post.
   */
  async confirmDayBookScan(input: {
    scanId: string;
    extract: DayBookExtractDraft;
  }): Promise<DayBookScanVm> {
    const entryDate = (
      input.extract.entryDate || new Date().toISOString().slice(0, 10)
    ).slice(0, 10);
    const finalized = await this.postDayBookConfirmLines({
      extract: { ...input.extract, entryDate },
    });

    const { data, error } = await this.sb.rpc('admin_confirm_day_book_scan', {
      p_scan_id: input.scanId,
      p_extract_json: finalized,
    });
    if (error) throwRpcError(error, 'Could not confirm day book scan');
    return this.mapDayBookScan(data as unknown as Row);
  }

  private async postDayBookConfirmLines(input: {
    extract: DayBookExtractDraft;
  }): Promise<DayBookExtractDraft> {
    const entryDate = (input.extract.entryDate || '').slice(0, 10);
    const lines = [];

    for (const line of input.extract.lines) {
      if (line.decision !== 'include') {
        lines.push(line);
        continue;
      }
      if (!line.amount || line.amount <= 0) {
        throw new Error(`Line "${line.rawText}" needs a positive amount`);
      }

      if (line.kind === 'expense') {
        const expense = await this.createCompanyExpense({
          expenseDate: entryDate,
          category: line.expenseCategory ?? 'OTHER',
          amount: line.amount,
          description:
            line.notes?.trim() ||
            line.partyHint?.trim() ||
            line.rawText ||
            'Day book expense',
          paymentMethod: 'CASH',
        });
        lines.push({ ...line, createdExpenseId: expense.id });
        continue;
      }

      if (line.kind === 'supplier_payment') {
        if (!line.matchedSupplierId) {
          throw new Error(
            `Line "${line.rawText}" needs a matched supplier before posting`,
          );
        }
        const payment = await this.recordSupplierPayment({
          supplierId: line.matchedSupplierId,
          paymentDate: entryDate,
          amount: line.amount,
          paymentMethod: 'CASH',
          notes:
            line.notes?.trim() ||
            `From day book (${input.extract.extractorLabel}): ${line.rawText}`,
        });
        lines.push({ ...line, createdSupplierPaymentId: payment.id });
        continue;
      }

      throw new Error(
        `Line "${line.rawText}" cannot be posted as ${line.kind}. Collections need an order.`,
      );
    }

    return { ...input.extract, lines };
  }

  async discardDayBookScan(scanId: string): Promise<void> {
    const { error } = await this.sb.rpc('admin_discard_day_book_scan', {
      p_scan_id: scanId,
    });
    if (error) throwRpcError(error, 'Could not discard day book scan');
  }

  private async mapDayBookScan(row: Row): Promise<DayBookScanVm> {
    const imagePath = row['imagePath']
      ? str(row['imagePath'])
      : row['image_path']
        ? str(row['image_path'])
        : null;
    let imageUrl: string | null = null;
    if (imagePath) {
      const signed = await this.sb.storage
        .from('day-book-scans')
        .createSignedUrl(imagePath, 60 * 60);
      if (!signed.error) imageUrl = signed.data?.signedUrl ?? null;
    }
    const extractRaw = row['extractJson'] ?? row['extract_json'] ?? {};
    const extract = parseDayBookExtractJson(extractRaw);
    const statusRaw = str(row['status'] ?? 'UPLOADED').toUpperCase();
    const status: DayBookScanStatus =
      statusRaw === 'REVIEWING' ||
      statusRaw === 'CONFIRMED' ||
      statusRaw === 'DISCARDED' ||
      statusRaw === 'UPLOADED'
        ? statusRaw
        : 'UPLOADED';
    return {
      id: str(row['id']),
      status,
      imagePath,
      imageUrl,
      sourceText: row['sourceText']
        ? str(row['sourceText'])
        : row['source_text']
          ? str(row['source_text'])
          : null,
      extract,
      extractorLabel: str(
        row['extractorLabel'] ??
          row['extractor_label'] ??
          extract.extractorLabel,
      ),
      notes: row['notes'] ? str(row['notes']) : null,
      createdAtLabel: row['createdAt']
        ? formatDateTime(str(row['createdAt']))
        : row['created_at']
          ? formatDateTime(str(row['created_at']))
          : '—',
    };
  }

  /** Phase 16: create an empty payment proof scan (admin only). */
  async createPaymentProofScan(notes?: string | null): Promise<PaymentProofScanVm> {
    const { data, error } = await this.sb.rpc('admin_create_payment_proof_scan', {
      p_notes: notes?.trim() || null,
    });
    if (error) throwRpcError(error, 'Could not create payment proof scan');
    return this.mapPaymentProofScan(data as unknown as Row);
  }

  async getPaymentProofScan(scanId: string): Promise<PaymentProofScanVm | null> {
    const { data, error } = await this.sb
      .from('payment_proof_scans')
      .select(
        'id, status, image_path, extract_json, extractor_label, order_id, shop_id, notes, created_at',
      )
      .eq('id', scanId)
      .maybeSingle();
    if (error) throwRpcError(error, 'Could not load payment proof scan');
    if (!data) return null;
    return this.mapPaymentProofScan(data as unknown as Row);
  }

  async uploadPaymentProofScanImage(
    scanId: string,
    file: { bytes: Blob | ArrayBuffer | Uint8Array; contentType: string },
  ): Promise<PaymentProofScanVm> {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(file.contentType)) {
      throw new Error('Use a JPEG, PNG, or WebP photo.');
    }
    const ext =
      file.contentType === 'image/png'
        ? 'png'
        : file.contentType === 'image/webp'
          ? 'webp'
          : 'jpg';
    const path = `${scanId}/proof.${ext}`;
    const { error: uploadError } = await this.sb.storage
      .from('payment-proofs')
      .upload(path, file.bytes, {
        contentType: file.contentType,
        upsert: true,
      });
    if (uploadError) {
      throw new Error(uploadError.message || 'Could not upload payment proof');
    }
    const { data, error } = await this.sb.rpc(
      'admin_set_payment_proof_scan_image',
      {
        p_scan_id: scanId,
        p_image_path: path,
      },
    );
    if (error) throwRpcError(error, 'Could not attach payment proof');
    return this.mapPaymentProofScan(data as unknown as Row);
  }

  async savePaymentProofScanExtract(
    scanId: string,
    extract: PaymentProofExtractDraft,
  ): Promise<PaymentProofScanVm> {
    const { data, error } = await this.sb.rpc(
      'admin_save_payment_proof_scan_extract',
      {
        p_scan_id: scanId,
        p_extract_json: extract,
        p_extractor_label: extract.extractorLabel || 'manual',
      },
    );
    if (error) throwRpcError(error, 'Could not save payment proof extract');
    return this.mapPaymentProofScan(data as unknown as Row);
  }

  async unpaidOrderCandidatesForShop(
    shopId: string,
  ): Promise<UnpaidOrderCandidate[]> {
    const { data: orders, error } = await this.sb
      .from('orders')
      .select('id, shop_id, status, total, created_at')
      .eq('shop_id', shopId)
      .neq('status', 'CANCELLED')
      .order('created_at', { ascending: false });
    if (error) throwRpcError(error, 'Could not load unpaid orders');
    const orderRows = (orders ?? []) as unknown as Row[];
    if (!orderRows.length) return [];

    const orderIds = orderRows.map((o) => str(o['id']));
    const { data: payments } = await this.sb
      .from('payments')
      .select(
        'order_id, status, cash_collected_amount, online_collected_amount',
      )
      .in('order_id', orderIds);
    const payMap = new Map<
      string,
      {
        status: string;
        cash_collected_amount?: number | null;
        online_collected_amount?: number | null;
      }
    >();
    for (const p of (payments ?? []) as Row[]) {
      payMap.set(str(p['order_id']), {
        status: str(p['status']),
        cash_collected_amount:
          p['cash_collected_amount'] != null
            ? num(p['cash_collected_amount'])
            : null,
        online_collected_amount:
          p['online_collected_amount'] != null
            ? num(p['online_collected_amount'])
            : null,
      });
    }

    return buildUnpaidOrderCandidates(
      orderRows.map((o) => ({
        id: str(o['id']),
        shopId: str(o['shop_id']),
        status: str(o['status']),
        total: num(o['total']),
        createdAt: str(o['created_at']),
      })),
      payMap,
      formatDateTime,
      (id) => shortCode(id, 'GA'),
    );
  }

  /**
   * Confirm path: owner-selected order → mark payment received, then link scan.
   * Never marks paid from image alone.
   */
  async confirmPaymentProofScan(input: {
    scanId: string;
    extract: PaymentProofExtractDraft;
    orderId: string;
    shopId?: string | null;
  }): Promise<{ scan: PaymentProofScanVm }> {
    if (!input.orderId) {
      throw new Error('Choose an unpaid order before confirming');
    }

    await this.savePaymentProofScanExtract(input.scanId, input.extract);
    await this.markOrderPaymentReceived(
      input.orderId,
      input.extract.collectionMethod ?? 'UPI_ON_DELIVERY',
    );

    const { data, error } = await this.sb.rpc(
      'admin_confirm_payment_proof_scan',
      {
        p_scan_id: input.scanId,
        p_order_id: input.orderId,
        p_shop_id: input.shopId ?? input.extract.matchedCustomerId ?? null,
      },
    );
    if (error) throwRpcError(error, 'Could not confirm payment proof');
    const scan = await this.mapPaymentProofScan(data as unknown as Row);
    return { scan };
  }

  async discardPaymentProofScan(scanId: string): Promise<void> {
    const { error } = await this.sb.rpc('admin_discard_payment_proof_scan', {
      p_scan_id: scanId,
    });
    if (error) throwRpcError(error, 'Could not discard payment proof');
  }

  private async mapPaymentProofScan(row: Row): Promise<PaymentProofScanVm> {
    const imagePath = row['imagePath']
      ? str(row['imagePath'])
      : row['image_path']
        ? str(row['image_path'])
        : null;
    let imageUrl: string | null = null;
    if (imagePath) {
      const signed = await this.sb.storage
        .from('payment-proofs')
        .createSignedUrl(imagePath, 60 * 60);
      if (!signed.error) imageUrl = signed.data?.signedUrl ?? null;
    }
    const extractRaw = row['extractJson'] ?? row['extract_json'] ?? {};
    const extract = parsePaymentProofExtractJson(extractRaw);
    const statusRaw = str(row['status'] ?? 'UPLOADED').toUpperCase();
    const status: PaymentProofScanStatus =
      statusRaw === 'REVIEWING' ||
      statusRaw === 'CONFIRMED' ||
      statusRaw === 'DISCARDED' ||
      statusRaw === 'UPLOADED'
        ? statusRaw
        : 'UPLOADED';
    return {
      id: str(row['id']),
      status,
      imagePath,
      imageUrl,
      extract,
      extractorLabel: str(
        row['extractorLabel'] ??
          row['extractor_label'] ??
          extract.extractorLabel,
      ),
      orderId: row['orderId']
        ? str(row['orderId'])
        : row['order_id']
          ? str(row['order_id'])
          : null,
      shopId: row['shopId']
        ? str(row['shopId'])
        : row['shop_id']
          ? str(row['shop_id'])
          : null,
      notes: row['notes'] ? str(row['notes']) : null,
      createdAtLabel: row['createdAt']
        ? formatDateTime(str(row['createdAt']))
        : row['created_at']
          ? formatDateTime(str(row['created_at']))
          : '—',
    };
  }

  async dayBookSnapshot(opts: {
    dateFrom: string;
    dateTo: string;
    type?: DayBookEntryType | 'all';
    paymentMethod?: string;
  }): Promise<DayBookSnapshot> {
    const range = businessDateRangeInclusive(opts.dateFrom, opts.dateTo);
    const fromTs = range.fromIso;
    const toTs = range.toIsoInclusive;

    const [
      ordersRes,
      paymentsByPaid,
      paymentsByCreated,
      expensesRes,
      payrollRes,
      supplierPaymentsRes,
    ] = await Promise.all([
        this.sb
          .from('orders')
          .select('id, shop_id, status, total, created_at')
          .gte('created_at', fromTs)
          .lte('created_at', toTs),
        this.sb
          .from('payments')
          .select(
            'id, order_id, status, amount, cash_collected_amount, online_collected_amount, paid_at, created_at, collection_method, method_intent',
          )
          .gte('paid_at', fromTs)
          .lte('paid_at', toTs),
        this.sb
          .from('payments')
          .select(
            'id, order_id, status, amount, cash_collected_amount, online_collected_amount, paid_at, created_at, collection_method, method_intent',
          )
          .gte('created_at', fromTs)
          .lte('created_at', toTs),
        this.sb
          .from('company_expenses')
          .select('*')
          .gte('expense_date', opts.dateFrom)
          .lte('expense_date', opts.dateTo),
        this.sb
          .from('salesman_payroll')
          .select(
            'id, salesman_profile_id, payroll_month, total_amount, paid_at, payment_method, status',
          )
          .eq('status', 'PAID')
          .gte('paid_at', fromTs)
          .lte('paid_at', toTs),
        this.sb
          .from('supplier_payments')
          .select(
            'id, supplier_id, purchase_id, payment_date, amount, payment_method, reference_number, notes, created_at',
          )
          .gte('payment_date', opts.dateFrom)
          .lte('payment_date', opts.dateTo),
      ]);

    if (ordersRes.error) throwRpcError(ordersRes.error, 'Could not load day book sales');
    if (paymentsByPaid.error) {
      throwRpcError(paymentsByPaid.error, 'Could not load day book collections');
    }
    if (paymentsByCreated.error) {
      throwRpcError(paymentsByCreated.error, 'Could not load day book collections');
    }
    if (expensesRes.error) {
      throwRpcError(expensesRes.error, 'Could not load day book expenses');
    }
    if (payrollRes.error) {
      throwRpcError(payrollRes.error, 'Could not load day book payroll');
    }
    if (supplierPaymentsRes.error) {
      throwRpcError(
        supplierPaymentsRes.error,
        'Could not load day book supplier payments',
      );
    }

    const paymentMap = new Map<string, Row>();
    for (const p of [
      ...((paymentsByPaid.data ?? []) as Row[]),
      ...((paymentsByCreated.data ?? []) as Row[]),
    ]) {
      paymentMap.set(str(p['id']), p);
    }
    const paymentRows = [...paymentMap.values()];

    const orderMap = new Map<string, Row>();
    for (const o of (ordersRes.data ?? []) as Row[]) {
      orderMap.set(str(o['id']), o);
    }
    const missingOrderIds = paymentRows
      .map((p) => str(p['order_id']))
      .filter((id) => !orderMap.has(id));
    if (missingOrderIds.length) {
      const { data: extraOrders, error: extraErr } = await this.sb
        .from('orders')
        .select('id, shop_id, status, total, created_at')
        .in('id', missingOrderIds);
      if (extraErr) throwRpcError(extraErr, 'Could not load day book orders');
      for (const o of (extraOrders ?? []) as Row[]) {
        orderMap.set(str(o['id']), o);
      }
    }

    const allOrders = [...orderMap.values()];
    const allOrderIds = allOrders.map((o) => str(o['id']));

    // Prefer full payment rows for those orders so residual/paid logic is complete.
    const { data: paymentsData, error: paymentsError } = allOrderIds.length
      ? await this.sb
          .from('payments')
          .select(
            'id, order_id, status, amount, cash_collected_amount, online_collected_amount, paid_at, created_at, collection_method, method_intent',
          )
          .in('order_id', allOrderIds)
      : { data: [] as Row[], error: null };
    if (paymentsError) throwRpcError(paymentsError, 'Could not load day book payments');

    const shopIds = [...new Set(allOrders.map((o) => str(o['shop_id'])))];
    const { data: shops } = shopIds.length
      ? await this.sb.from('shops').select('id, trade_name').in('id', shopIds)
      : { data: [] as Row[] };
    const shopMap = new Map(
      ((shops ?? []) as Row[]).map((s) => [str(s['id']), str(s['trade_name'])]),
    );

    const expenses = ((expensesRes.data ?? []) as Row[]).map((row) =>
      mapCompanyExpenseRow({
        id: str(row['id']),
        expense_date: str(row['expense_date']),
        category: str(row['category']),
        amount: num(row['amount']),
        description: str(row['description']),
        payment_method: str(row['payment_method']),
        reference_number: row['reference_number']
          ? str(row['reference_number'])
          : null,
        receipt_path: row['receipt_path'] ? str(row['receipt_path']) : null,
        created_at: str(row['created_at']),
        updated_at: str(row['updated_at']),
      }),
    );

    const payments = ((paymentsData ?? []) as Row[]).map((p) => {
      const collectionMethod = p['collection_method']
        ? str(p['collection_method'])
        : '';
      const methodIntent = p['method_intent'] ? str(p['method_intent']) : '';
      return {
        id: str(p['id']),
        order_id: str(p['order_id']),
        status: str(p['status']),
        amount: num(p['amount']),
        cash_collected_amount: num(p['cash_collected_amount']),
        online_collected_amount: num(p['online_collected_amount']),
        paid_at: p['paid_at'] ? str(p['paid_at']) : null,
        created_at: p['created_at'] ? str(p['created_at']) : null,
        method_label: collectionMethod
          ? collectionMethodLabel(collectionMethod)
          : methodIntent === 'PAY_ONLINE_NOW'
            ? 'Online'
            : methodIntent === 'PAY_ON_DELIVERY'
              ? 'Pay on delivery'
              : null,
      };
    });

    const payrollRows = (payrollRes.data ?? []) as Row[];
    const payrollSalesmanIds = [
      ...new Set(payrollRows.map((r) => str(r['salesman_profile_id']))),
    ];
    const { data: payrollProfiles } = payrollSalesmanIds.length
      ? await this.sb
          .from('profiles')
          .select('id, display_name')
          .in('id', payrollSalesmanIds)
      : { data: [] as Row[] };
    const payrollNameMap = new Map(
      ((payrollProfiles ?? []) as Row[]).map((p) => [
        str(p['id']),
        str(p['display_name']),
      ]),
    );
    const paidPayroll = payrollRows.map((row) => {
      const method = row['payment_method'] ? str(row['payment_method']) : 'OTHER';
      return {
        id: str(row['id']),
        salesmanId: str(row['salesman_profile_id']),
        salesmanName:
          payrollNameMap.get(str(row['salesman_profile_id'])) ?? 'Salesman',
        payrollMonth: str(row['payroll_month']),
        totalAmount: num(row['total_amount']),
        paidAt: str(row['paid_at']),
        paymentMethodLabel:
          PAYROLL_PAYMENT_METHOD_LABELS[
            method as keyof typeof PAYROLL_PAYMENT_METHOD_LABELS
          ] ?? method,
      };
    });

    const supplierPaymentRows = (supplierPaymentsRes.data ?? []) as Row[];
    const supplierIds = [
      ...new Set(supplierPaymentRows.map((r) => str(r['supplier_id']))),
    ];
    const { data: supplierRows } = supplierIds.length
      ? await this.sb.from('suppliers').select('id, name').in('id', supplierIds)
      : { data: [] as Row[] };
    const supplierNameMap = new Map(
      ((supplierRows ?? []) as Row[]).map((s) => [str(s['id']), str(s['name'])]),
    );
    const supplierPayments = supplierPaymentRows.map((row) => ({
      id: str(row['id']),
      supplierId: str(row['supplier_id']),
      purchaseId: row['purchase_id'] ? str(row['purchase_id']) : null,
      paymentDate: str(row['payment_date']),
      amount: num(row['amount']),
      paymentMethod: mapSupplierPaymentMethod(str(row['payment_method'])),
      referenceNumber: row['reference_number']
        ? str(row['reference_number'])
        : null,
      notes: row['notes'] ? str(row['notes']) : null,
      createdAt: row['created_at'] ? str(row['created_at']) : null,
      supplierName:
        supplierNameMap.get(str(row['supplier_id'])) ?? 'Supplier',
    }));

    return buildDayBookSnapshot({
      generatedAtIso: new Date().toISOString(),
      dateFrom: opts.dateFrom,
      dateTo: opts.dateTo,
      type: opts.type,
      paymentMethod: opts.paymentMethod,
      orders: allOrders.map((o) => ({
        id: str(o['id']),
        status: str(o['status']),
        total: num(o['total']),
        created_at: str(o['created_at']),
        order_code: shortCode(str(o['id']), 'GA'),
        shop_name: shopMap.get(str(o['shop_id'])) ?? 'Customer',
      })),
      payments,
      expenses,
      paidPayroll,
      supplierPayments,
    });
  }

  async payrollMonthSnapshot(month: string): Promise<PayrollMonthSummary> {
    const monthStart = payrollMonthStart(month);
    const { data, error } = await this.sb
      .from('salesman_payroll')
      .select('*')
      .eq('payroll_month', monthStart)
      .order('updated_at', { ascending: false });
    if (error) throwRpcError(error, 'Could not load payroll');
    const rows = (data ?? []) as Row[];
    const ids = [...new Set(rows.map((r) => str(r['salesman_profile_id'])))];
    const { data: profiles } = ids.length
      ? await this.sb.from('profiles').select('id, display_name').in('id', ids)
      : { data: [] as Row[] };
    const nameMap = new Map(
      ((profiles ?? []) as Row[]).map((p) => [
        str(p['id']),
        str(p['display_name']),
      ]),
    );
    return buildPayrollMonthSummary({
      month: monthStart,
      rows: rows.map((row) =>
        mapPayrollRow({
          id: str(row['id']),
          salesman_profile_id: str(row['salesman_profile_id']),
          salesman_name: nameMap.get(str(row['salesman_profile_id'])),
          payroll_month: str(row['payroll_month']),
          earning_model: str(row['earning_model']),
          base_salary: num(row['base_salary']),
          unpaid_leave_days: num(row['unpaid_leave_days']),
          unpaid_deduction: num(row['unpaid_deduction']),
          earned_commission: num(row['earned_commission']),
          daily_allowance: num(row['daily_allowance']),
          other_allowance: num(row['other_allowance']),
          adjustments: num(row['adjustments']),
          total_amount: num(row['total_amount']),
          status: str(row['status']),
          paid_at: row['paid_at'] ? str(row['paid_at']) : null,
          payment_method: row['payment_method']
            ? str(row['payment_method'])
            : null,
          payment_reference: row['payment_reference']
            ? str(row['payment_reference'])
            : null,
          notes: row['notes'] ? str(row['notes']) : null,
          calculated_at: str(row['calculated_at']),
        }),
      ),
    });
  }

  async listSalesmanPayroll(salesmanId: string): Promise<PayrollRow[]> {
    const { data, error } = await this.sb
      .from('salesman_payroll')
      .select('*')
      .eq('salesman_profile_id', salesmanId)
      .order('payroll_month', { ascending: false });
    if (error) throwRpcError(error, 'Could not load salesman payroll');
    const { data: profile } = await this.sb
      .from('profiles')
      .select('display_name')
      .eq('id', salesmanId)
      .maybeSingle();
    const name = profile?.display_name ? str(profile.display_name) : 'Salesman';
    return ((data ?? []) as Row[]).map((row) =>
      mapPayrollRow({
        id: str(row['id']),
        salesman_profile_id: str(row['salesman_profile_id']),
        salesman_name: name,
        payroll_month: str(row['payroll_month']),
        earning_model: str(row['earning_model']),
        base_salary: num(row['base_salary']),
        unpaid_leave_days: num(row['unpaid_leave_days']),
        unpaid_deduction: num(row['unpaid_deduction']),
        earned_commission: num(row['earned_commission']),
        daily_allowance: num(row['daily_allowance']),
        other_allowance: num(row['other_allowance']),
        adjustments: num(row['adjustments']),
        total_amount: num(row['total_amount']),
        status: str(row['status']),
        paid_at: row['paid_at'] ? str(row['paid_at']) : null,
        payment_method: row['payment_method']
          ? str(row['payment_method'])
          : null,
        payment_reference: row['payment_reference']
          ? str(row['payment_reference'])
          : null,
        notes: row['notes'] ? str(row['notes']) : null,
        calculated_at: str(row['calculated_at']),
      }),
    );
  }

  /**
   * Owner financial overview for Dashboard + P&amp;L.
   * Reuses Day Book, receivables, expenses, payroll, and sales register.
   */
  async ownerFinancialOverview(): Promise<{
    generatedAtLabel: string;
    kpis: KpiCardItem[];
    customersWithMoneyDue: number;
    suppliersWithMoneyToPay: number;
  }> {
    const now = new Date();
    const today = ymdInBusinessTz(now);
    const monthStart = `${today.slice(0, 7)}-01`;
    const todayRange = businessDateRangeInclusive(today, today);
    const monthRange = businessDateRangeInclusive(monthStart, today);

    const [dayBookToday, receivables, expensesSnap, salesToday, salesMonth] =
      await Promise.all([
        this.dayBookSnapshot({ dateFrom: today, dateTo: today }),
        this.receivablesSnapshot(),
        this.companyExpensesSnapshot(),
        this.listSalesRegister({
          fromIso: todayRange.fromIso,
          toIso: todayRange.toIsoInclusive,
          limit: 500,
        }),
        this.listSalesRegister({
          fromIso: monthRange.fromIso,
          toIso: monthRange.toIsoInclusive,
          limit: 500,
        }),
      ]);

    const byType = summarizeDayBookByType(dayBookToday.entries);
    const expensesMonth = filterExpensesByDate(
      expensesSnap.rows,
      monthStart,
      today,
    ).reduce((s, r) => s + r.amount, 0);

    const kpis = buildOwnerFinancialKpis({
      todaySales: sumSalesTotal(
        salesToday.map((r) => ({
          id: r.saleId,
          total: r.amount,
          convertedAt: r.saleDateIso,
          status: r.saleStatus,
        })),
      ),
      monthSales: sumSalesTotal(
        salesMonth.map((r) => ({
          id: r.saleId,
          total: r.amount,
          convertedAt: r.saleDateIso,
          status: r.saleStatus,
        })),
      ),
      collectionsToday: byType.collectionsIn + byType.salesIn,
      outstanding: receivables.totalOutstanding,
      expensesMonth,
      netCashToday: byType.net,
    });

    const payables = await this.supplierPayablesSnapshot();

    return {
      generatedAtLabel: `Updated ${formatDateTime(now.toISOString())}`,
      kpis,
      customersWithMoneyDue: receivables.rows.filter(
        (row) => row.outstanding > 0,
      ).length,
      suppliersWithMoneyToPay: payables.suppliersWithDues,
    };
  }

  /**
   * Profit &amp; Loss for a date range from Day Book + sales + expenses +
   * paid payroll + inventory COGS (WAC consumption).
   */
  async profitLossSnapshot(opts: {
    dateFrom: string;
    dateTo: string;
  }): Promise<{
    generatedAtLabel: string;
    rangeLabel: string;
    profitLoss: ProfitLossVm;
    dayBookByType: ReturnType<typeof summarizeDayBookByType>;
  }> {
    const from = opts.dateFrom.slice(0, 10);
    const to = opts.dateTo.slice(0, 10);
    const range = businessDateRangeInclusive(from, to);

    const [dayBook, expensesSnap, salesRows, payrollRes, movementsRes] =
      await Promise.all([
        this.dayBookSnapshot({ dateFrom: from, dateTo: to }),
        this.companyExpensesSnapshot(),
        this.listSalesRegister({
          fromIso: range.fromIso,
          toIso: range.toIsoInclusive,
          limit: 2000,
        }),
        this.sb
          .from('salesman_payroll')
          .select(
            'id, salesman_profile_id, payroll_month, earning_model, base_salary, unpaid_leave_days, unpaid_deduction, earned_commission, daily_allowance, other_allowance, adjustments, total_amount, status, paid_at, payment_method, payment_reference, notes, calculated_at',
          )
          .eq('status', 'PAID')
          .gte('paid_at', range.fromIso)
          .lt('paid_at', range.toIsoExclusive),
        this.sb
          .from('inventory_movements')
          .select('movement_type, quantity_delta, unit_cost, created_at')
          .in('movement_type', ['ORDER_DISPATCH', 'RETURN'])
          .gte('created_at', range.fromIso)
          .lt('created_at', range.toIsoExclusive)
          .limit(5000),
      ]);

    if (payrollRes.error) {
      throwRpcError(payrollRes.error, 'Could not load paid payroll for P&L');
    }
    if (movementsRes.error) {
      throwRpcError(movementsRes.error, 'Could not load inventory COGS for P&L');
    }

    const byType = summarizeDayBookByType(dayBook.entries);
    const expensesTotal = filterExpensesByDate(
      expensesSnap.rows,
      from,
      to,
    ).reduce((s, r) => s + r.amount, 0);

    const payrollRows = ((payrollRes.data ?? []) as Row[]).map((row) =>
      mapPayrollRow({
        id: str(row['id']),
        salesman_profile_id: str(row['salesman_profile_id']),
        payroll_month: str(row['payroll_month']),
        earning_model: str(row['earning_model']),
        base_salary: num(row['base_salary']),
        unpaid_leave_days: num(row['unpaid_leave_days']),
        unpaid_deduction: num(row['unpaid_deduction']),
        earned_commission: num(row['earned_commission']),
        daily_allowance: num(row['daily_allowance']),
        other_allowance: num(row['other_allowance']),
        adjustments: num(row['adjustments']),
        total_amount: num(row['total_amount']),
        status: str(row['status']),
        paid_at: row['paid_at'] ? str(row['paid_at']) : null,
        payment_method: row['payment_method']
          ? str(row['payment_method'])
          : null,
        calculated_at: str(row['calculated_at']),
      }),
    );

    const cogs = sumInventoryCogs(
      ((movementsRes.data ?? []) as Row[]).map((row) => ({
        movementType: str(row['movement_type']),
        quantityDelta: num(row['quantity_delta']),
        unitCost:
          row['unit_cost'] == null ? null : num(row['unit_cost']),
      })),
    );

    const profitLoss = buildProfitLoss({
      salesTotal: sumSalesTotal(
        salesRows.map((r) => ({
          id: r.saleId,
          total: r.amount,
          convertedAt: r.saleDateIso,
          status: r.saleStatus,
        })),
      ),
      collectionsTotal: byType.salesIn + byType.collectionsIn,
      refundsTotal: byType.refundsOut,
      expensesTotal,
      payrollPaidTotal: sumPaidPayroll(payrollRows),
      cogsTotal: cogs.cogsTotal,
      cogsIncomplete: cogs.incompleteMovementCount > 0,
    });

    return {
      generatedAtLabel: `Updated ${formatDateTime(new Date().toISOString())}`,
      rangeLabel: `${from} → ${to}`,
      profitLoss,
      dayBookByType: byType,
    };
  }

  /**
   * Phase 6 Books snapshot: chart of accounts, journals in range, trial balance.
   * Journals are posted from domain events via admin_sync_accounting_journals.
   */
  async accountingSnapshot(opts: {
    dateFrom: string;
    dateTo: string;
  }): Promise<AccountingSnapshot> {
    const from = opts.dateFrom.slice(0, 10);
    const to = opts.dateTo.slice(0, 10);

    const [accountsRes, journalsRes, linesRes] = await Promise.all([
      this.sb
        .from('chart_of_accounts')
        .select('*')
        .eq('is_active', true)
        .order('code', { ascending: true }),
      this.sb
        .from('journal_entries')
        .select('*')
        .gte('entry_date', from)
        .lte('entry_date', to)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500),
      this.sb
        .from('journal_lines')
        .select('id, journal_entry_id, account_id, debit, credit')
        .limit(5000),
    ]);

    if (accountsRes.error) {
      throwRpcError(accountsRes.error, 'Could not load chart of accounts');
    }
    if (journalsRes.error) {
      throwRpcError(journalsRes.error, 'Could not load journal entries');
    }
    if (linesRes.error) {
      throwRpcError(linesRes.error, 'Could not load journal lines');
    }

    const accounts: ChartAccountRow[] = ((accountsRes.data ?? []) as Row[]).map(
      (row) => {
        const accountType = str(row['account_type']).toUpperCase() as AccountType;
        return {
          id: str(row['id']),
          code: str(row['code']),
          name: str(row['name']),
          accountType,
          accountTypeLabel: ACCOUNT_TYPE_LABELS[accountType] ?? accountType,
          isSystem: row['is_system'] === true,
          isActive: row['is_active'] !== false,
        };
      },
    );

    const journalIds = new Set(
      ((journalsRes.data ?? []) as Row[]).map((row) => str(row['id'])),
    );
    const lineRows = ((linesRes.data ?? []) as Row[]).filter((row) =>
      journalIds.has(str(row['journal_entry_id'])),
    );

    const debitByJournal = new Map<string, number>();
    const countByJournal = new Map<string, number>();
    for (const line of lineRows) {
      const jid = str(line['journal_entry_id']);
      debitByJournal.set(
        jid,
        moneyRound((debitByJournal.get(jid) ?? 0) + num(line['debit'])),
      );
      countByJournal.set(jid, (countByJournal.get(jid) ?? 0) + 1);
    }

    const journals = ((journalsRes.data ?? []) as Row[]).map((row) => {
      const id = str(row['id']);
      const totalDebit = debitByJournal.get(id) ?? 0;
      const sourceType = str(row['source_type']);
      return {
        id,
        entryDate: str(row['entry_date']),
        entryDateLabel: formatDate(str(row['entry_date'])),
        sourceType,
        sourceTypeLabel: journalSourceLabel(sourceType),
        sourceId: str(row['source_id']),
        memo: str(row['memo']),
        totalDebit,
        totalDebitLabel: formatInr(totalDebit),
        lineCount: countByJournal.get(id) ?? 0,
      };
    });

    const tb = buildTrialBalanceRows(
      accounts,
      lineRows.map((row) => ({
        accountId: str(row['account_id']),
        debit: num(row['debit']),
        credit: num(row['credit']),
      })),
    );

    return {
      generatedAtLabel: `Updated ${formatDateTime(new Date().toISOString())}`,
      rangeLabel: `${from} → ${to}`,
      accountCount: accounts.length,
      journalCount: journals.length,
      trialBalanceBalanced: tb.balanced,
      totalDebitsLabel: formatInr(tb.totalDebit),
      totalCreditsLabel: formatInr(tb.totalCredit),
      accounts,
      journals,
      trialBalance: tb.rows,
      lastSyncLabel: null,
    };
  }

  async syncAccountingJournals(opts: {
    dateFrom: string;
    dateTo: string;
  }): Promise<{ posted: number; skipped: number; dateFrom: string; dateTo: string }> {
    const { data, error } = await this.sb.rpc('admin_sync_accounting_journals', {
      p_date_from: opts.dateFrom.slice(0, 10),
      p_date_to: opts.dateTo.slice(0, 10),
    });
    if (error) throwRpcError(error, 'Could not sync accounting journals');
    const row = (data ?? {}) as Row;
    return {
      posted: num(row['posted']),
      skipped: num(row['skipped']),
      dateFrom: str(row['dateFrom'] ?? opts.dateFrom),
      dateTo: str(row['dateTo'] ?? opts.dateTo),
    };
  }

  /**
   * Phase 7 Cash & Bank snapshot from posted journal lines only.
   * Never invents balances when the ledger is empty.
   */
  async cashBankSnapshot(opts: { asOfDate: string }): Promise<CashBankSnapshot> {
    const asOfDate = opts.asOfDate.slice(0, 10);

    const { data: accounts, error: accountsError } = await this.sb
      .from('chart_of_accounts')
      .select('id, code, name')
      .in('code', [
        CASH_ACCOUNT_CODE,
        BANK_ACCOUNT_CODE,
        AR_ACCOUNT_CODE,
        AP_ACCOUNT_CODE,
      ]);
    if (accountsError) {
      throwRpcError(accountsError, 'Could not load cash/bank accounts');
    }

    const accountRows = (accounts ?? []) as Row[];
    const idByCode = new Map(
      accountRows.map((row) => [str(row['code']), str(row['id'])] as const),
    );
    const nameByCode = new Map(
      accountRows.map((row) => [str(row['code']), str(row['name'])] as const),
    );
    const codeById = new Map(
      accountRows.map((row) => [str(row['id']), str(row['code'])] as const),
    );
    const cashId = idByCode.get(CASH_ACCOUNT_CODE);
    const bankId = idByCode.get(BANK_ACCOUNT_CODE);
    const arId = idByCode.get(AR_ACCOUNT_CODE);
    const apId = idByCode.get(AP_ACCOUNT_CODE);
    const trackedIds = [cashId, bankId, arId, apId].filter(Boolean) as string[];

    if (trackedIds.length === 0) {
      return {
        generatedAtLabel: `Updated ${formatDateTime(new Date().toISOString())}`,
        asOfDate,
        asOfDateLabel: formatDate(asOfDate),
        cashBalance: 0,
        cashBalanceLabel: '—',
        bankBalance: 0,
        bankBalanceLabel: '—',
        moneyExpected: 0,
        moneyExpectedLabel: '—',
        moneyToPay: 0,
        moneyToPayLabel: '—',
        hasLedgerActivity: false,
        honestyNote: buildCashBankHonestyNote(false),
        movements: [],
      };
    }

    const { data: entries, error: entriesError } = await this.sb
      .from('journal_entries')
      .select('id, entry_date, source_type, memo')
      .lte('entry_date', asOfDate)
      .order('entry_date', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(5000);
    if (entriesError) {
      throwRpcError(entriesError, 'Could not load cash/bank journals');
    }

    const entryRows = (entries ?? []) as Row[];
    const entryIds = entryRows.map((row) => str(row['id']));
    const entryById = new Map(
      entryRows.map((row) => [str(row['id']), row] as const),
    );

    let lineRows: Row[] = [];
    if (entryIds.length > 0) {
      const { data: lines, error: linesError } = await this.sb
        .from('journal_lines')
        .select('id, journal_entry_id, account_id, debit, credit')
        .in('journal_entry_id', entryIds)
        .in('account_id', trackedIds)
        .limit(8000);
      if (linesError) {
        throwRpcError(linesError, 'Could not load cash/bank journal lines');
      }
      lineRows = (lines ?? []) as Row[];
    }

    const totals = new Map<string, { debit: number; credit: number }>();
    for (const line of lineRows) {
      const accountId = str(line['account_id']);
      const cur = totals.get(accountId) ?? { debit: 0, credit: 0 };
      cur.debit += num(line['debit']);
      cur.credit += num(line['credit']);
      totals.set(accountId, cur);
    }

    const cashTotals = cashId
      ? totals.get(cashId) ?? { debit: 0, credit: 0 }
      : { debit: 0, credit: 0 };
    const bankTotals = bankId
      ? totals.get(bankId) ?? { debit: 0, credit: 0 }
      : { debit: 0, credit: 0 };
    const arTotals = arId
      ? totals.get(arId) ?? { debit: 0, credit: 0 }
      : { debit: 0, credit: 0 };
    const apTotals = apId
      ? totals.get(apId) ?? { debit: 0, credit: 0 }
      : { debit: 0, credit: 0 };

    const cashBalance = ledgerAssetBalance(cashTotals.debit, cashTotals.credit);
    const bankBalance = ledgerAssetBalance(bankTotals.debit, bankTotals.credit);
    const moneyExpected = ledgerAssetBalance(arTotals.debit, arTotals.credit);
    const moneyToPay = ledgerLiabilityBalance(apTotals.debit, apTotals.credit);

    const cashBankIds = new Set(
      [cashId, bankId].filter(Boolean) as string[],
    );
    const movementSource = lineRows
      .filter((line) => cashBankIds.has(str(line['account_id'])))
      .map((line) => {
        const entry = entryById.get(str(line['journal_entry_id']));
        const accountCode = codeById.get(str(line['account_id'])) ?? '—';
        const debit = num(line['debit']);
        const credit = num(line['credit']);
        const sourceType = entry ? str(entry['source_type']) : '';
        return {
          id: str(line['id']),
          entryDate: entry ? str(entry['entry_date']) : asOfDate,
          entryDateLabel: formatDate(entry ? str(entry['entry_date']) : asOfDate),
          accountCode,
          accountLabel: nameByCode.get(accountCode) ?? accountCode,
          sourceType,
          sourceTypeLabel: journalSourceLabel(sourceType),
          memo: entry ? str(entry['memo']) : '—',
          debit,
          credit,
          amountLabel: formatInr(debit > 0 ? debit : credit),
          sortKey: `${entry ? str(entry['entry_date']) : ''}|${str(line['id'])}`,
        };
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    const movements = attachRunningBalances(
      movementSource.map(({ sortKey: _sortKey, ...row }) => row),
      0,
    );

    const hasLedgerActivity = lineRows.length > 0;

    return {
      generatedAtLabel: `Updated ${formatDateTime(new Date().toISOString())}`,
      asOfDate,
      asOfDateLabel: formatDate(asOfDate),
      cashBalance,
      cashBalanceLabel: hasLedgerActivity ? formatInr(cashBalance) : '—',
      bankBalance,
      bankBalanceLabel: hasLedgerActivity ? formatInr(bankBalance) : '—',
      moneyExpected,
      moneyExpectedLabel: hasLedgerActivity ? formatInr(moneyExpected) : '—',
      moneyToPay,
      moneyToPayLabel: hasLedgerActivity ? formatInr(moneyToPay) : '—',
      hasLedgerActivity,
      honestyNote: buildCashBankHonestyNote(hasLedgerActivity),
      movements,
    };
  }

  async recordCashBankTransfer(input: {
    entryDate: string;
    amount: number;
    direction: CashBankTransferDirection;
    memo?: string | null;
  }): Promise<string> {
    const { data, error } = await this.sb.rpc('admin_record_cash_bank_transfer', {
      p_entry_date: input.entryDate.slice(0, 10),
      p_amount: input.amount,
      p_direction: input.direction,
      p_memo: input.memo?.trim() || null,
    });
    if (error) throwRpcError(error, 'Could not record cash/bank transfer');
    return str(data);
  }

  async recordCashBankOpening(input: {
    entryDate: string;
    cashAmount?: number;
    bankAmount?: number;
    memo?: string | null;
  }): Promise<string> {
    const { data, error } = await this.sb.rpc('admin_record_cash_bank_opening', {
      p_entry_date: input.entryDate.slice(0, 10),
      p_cash_amount: input.cashAmount ?? 0,
      p_bank_amount: input.bankAmount ?? 0,
      p_memo: input.memo?.trim() || null,
    });
    if (error) throwRpcError(error, 'Could not record opening balances');
    return str(data);
  }

  async recordCashBankExternal(input: {
    entryDate: string;
    account: CashBankAccountKind;
    kind: CashBankExternalKind;
    amount: number;
    memo?: string | null;
  }): Promise<string> {
    const { data, error } = await this.sb.rpc('admin_record_cash_bank_external', {
      p_entry_date: input.entryDate.slice(0, 10),
      p_account: input.account,
      p_kind: input.kind,
      p_amount: input.amount,
      p_memo: input.memo?.trim() || null,
    });
    if (error) throwRpcError(error, 'Could not record deposit/withdrawal');
    return str(data);
  }

  /**
   * Phase 9 — GST input-tax summary from received purchases in range.
   * Not a GSTR filing export.
   */
  async gstTaxSummary(opts: {
    dateFrom: string;
    dateTo: string;
  }): Promise<GstTaxSummaryVm> {
    const from = opts.dateFrom.slice(0, 10);
    const to = opts.dateTo.slice(0, 10);

    const { data, error } = await this.sb
      .from('purchases')
      .select(
        'id, bill_number, purchase_date, supplier_id, subtotal, tax_amount, cgst_amount, sgst_amount, igst_amount, supply_type, status, received_at',
      )
      .eq('status', 'RECEIVED')
      .gte('purchase_date', from)
      .lte('purchase_date', to)
      .order('purchase_date', { ascending: true })
      .limit(2000);
    if (error) throwRpcError(error, 'Could not load purchases for GST summary');

    const purchaseRows = (data ?? []) as unknown as Row[];
    const supplierIds = [
      ...new Set(purchaseRows.map((row) => str(row['supplier_id']))),
    ];
    const supplierMap = new Map<string, string>();
    if (supplierIds.length > 0) {
      const { data: suppliers, error: suppliersError } = await this.sb
        .from('suppliers')
        .select('id, name')
        .in('id', supplierIds);
      if (suppliersError) {
        throwRpcError(suppliersError, 'Could not load suppliers for GST summary');
      }
      for (const s of (suppliers ?? []) as Row[]) {
        supplierMap.set(str(s['id']), str(s['name']));
      }
    }

    return buildGstTaxSummary({
      generatedAtLabel: `Updated ${formatDateTime(new Date().toISOString())}`,
      rangeLabel: `${from} → ${to}`,
      purchases: purchaseRows.map((row) => ({
        id: str(row['id']),
        billNumber: str(row['bill_number']),
        purchaseDate: str(row['purchase_date']).slice(0, 10),
        purchaseDateLabel: formatDate(str(row['purchase_date'])),
        supplierName: supplierMap.get(str(row['supplier_id'])) ?? '—',
        supplyType: str(row['supply_type']) || 'UNSET',
        subtotal: num(row['subtotal']),
        taxAmount: num(row['tax_amount']),
        cgstAmount: num(row['cgst_amount']),
        sgstAmount: num(row['sgst_amount']),
        igstAmount: num(row['igst_amount']),
      })),
    });
  }

  /**
   * Phase 8 — P&L, Balance Sheet, Cash Flow, Trial Balance, and GL
   * from the same Books journal ledger (never invents balances).
   */
  async ledgerStatementsSnapshot(opts: {
    dateFrom: string;
    dateTo: string;
    glAccountCode?: string | null;
  }): Promise<LedgerStatementsSnapshot> {
    const from = opts.dateFrom.slice(0, 10);
    const to = opts.dateTo.slice(0, 10);

    const [accountsRes, journalsRes] = await Promise.all([
      this.sb
        .from('chart_of_accounts')
        .select('id, code, name, account_type')
        .eq('is_active', true)
        .order('code', { ascending: true }),
      this.sb
        .from('journal_entries')
        .select('id, entry_date, source_type, memo')
        .lte('entry_date', to)
        .order('entry_date', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(5000),
    ]);

    if (accountsRes.error) {
      throwRpcError(accountsRes.error, 'Could not load chart of accounts');
    }
    if (journalsRes.error) {
      throwRpcError(journalsRes.error, 'Could not load journal entries');
    }

    const accountRows = (accountsRes.data ?? []) as Row[];
    const accountById = new Map(
      accountRows.map((row) => {
        const accountType = str(row['account_type']).toUpperCase() as AccountType;
        return [
          str(row['id']),
          {
            id: str(row['id']),
            code: str(row['code']),
            name: str(row['name']),
            accountType,
          },
        ] as const;
      }),
    );

    const entryRows = (journalsRes.data ?? []) as Row[];
    const entryIds = entryRows.map((row) => str(row['id']));
    const entryById = new Map(
      entryRows.map((row) => [str(row['id']), row] as const),
    );

    let lineRows: Row[] = [];
    if (entryIds.length > 0) {
      const { data: lines, error: linesError } = await this.sb
        .from('journal_lines')
        .select('id, journal_entry_id, account_id, debit, credit')
        .in('journal_entry_id', entryIds)
        .limit(12000);
      if (linesError) {
        throwRpcError(linesError, 'Could not load journal lines');
      }
      lineRows = (lines ?? []) as Row[];
    }

    const allFacts: LedgerLineFact[] = [];
    for (const line of lineRows) {
      const entry = entryById.get(str(line['journal_entry_id']));
      const account = accountById.get(str(line['account_id']));
      if (!entry || !account) continue;
      allFacts.push({
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.accountType,
        journalId: str(entry['id']),
        entryDate: str(entry['entry_date']),
        sourceType: str(entry['source_type']),
        memo: str(entry['memo']),
        debit: num(line['debit']),
        credit: num(line['credit']),
      });
    }

    const openingFacts = allFacts.filter((f) => f.entryDate < from);
    const periodFacts = allFacts.filter(
      (f) => f.entryDate >= from && f.entryDate <= to,
    );
    const throughAsOf = allFacts.filter((f) => f.entryDate <= to);

    const periodJournalIds = new Set(periodFacts.map((f) => f.journalId));
    const openingCashBank = cashBankBalanceFromLines(openingFacts);
    const profitLoss = buildLedgerProfitLoss(periodFacts);
    const balanceSheet = buildBalanceSheet(throughAsOf, to);
    const cashFlow = buildCashFlowStatement({
      openingCashBank,
      periodLines: periodFacts,
    });
    const tb = buildLedgerTrialBalance(throughAsOf);
    const generalLedger = buildGeneralLedgerRows(
      periodFacts,
      (iso) => formatDate(iso),
      opts.glAccountCode ?? null,
    );

    const hasLedgerActivity = allFacts.length > 0;

    return {
      generatedAtLabel: `Updated ${formatDateTime(new Date().toISOString())}`,
      rangeLabel: `${from} → ${to}`,
      asOfDate: to,
      profitLoss,
      balanceSheet,
      cashFlow,
      trialBalance: tb.rows,
      trialBalanceBalanced: tb.balanced,
      trialBalanceDebitTotalLabel: formatInr(tb.totalDebit),
      trialBalanceCreditTotalLabel: formatInr(tb.totalCredit),
      generalLedger,
      journalCount: periodJournalIds.size,
      hasLedgerActivity,
      honestyNote: hasLedgerActivity
        ? 'All statements come from posted Books journals. Update Books before relying on these figures.'
        : 'No posted Books journals yet. Update Books for sales, collections, purchases, and expenses — statement balances are never invented.',
    };
  }

  /** Product sales from sale_items of non-refunded sales in the date range. */
  async productSalesReport(opts: {
    dateFrom: string | null;
    dateTo: string | null;
  }): Promise<{
    generatedAtLabel: string;
    rows: {
      product: string;
      sku: string;
      quantity: number;
      salesValue: number;
    }[];
  }> {
    let salesQuery = this.sb
      .from('sales')
      .select('id, converted_at, status')
      .neq('status', 'REFUNDED');
    if (opts.dateFrom) {
      salesQuery = salesQuery.gte(
        'converted_at',
        businessDayStartIso(opts.dateFrom),
      );
    }
    if (opts.dateTo) {
      salesQuery = salesQuery.lt(
        'converted_at',
        businessDayEndExclusiveIso(opts.dateTo),
      );
    }
    const { data: sales, error: salesErr } = await salesQuery.limit(2000);
    if (salesErr) throwRpcError(salesErr, 'Could not load sales for product report');
    const saleIds = ((sales ?? []) as Row[]).map((s) => str(s['id']));
    if (saleIds.length === 0) {
      return {
        generatedAtLabel: `Updated ${formatDateTime(new Date().toISOString())}`,
        rows: [],
      };
    }
    const { data: items, error: itemsErr } = await this.sb
      .from('sale_items')
      .select('sale_id, product_name, sku_code, sku_name, quantity, line_total')
      .in('sale_id', saleIds);
    if (itemsErr) throwRpcError(itemsErr, 'Could not load sale items');
    const rows = aggregateProductSales(
      ((items ?? []) as Row[]).map((item) => ({
        product_name: str(item['product_name']) || null,
        sku_code: str(item['sku_code']) || null,
        sku_name: str(item['sku_name']) || null,
        quantity: num(item['quantity']),
        line_total: num(item['line_total']),
      })),
    );
    return {
      generatedAtLabel: `Updated ${formatDateTime(new Date().toISOString())}`,
      rows,
    };
  }

  async calculateSalesmanPayroll(input: {
    salesmanId: string;
    month: string;
    adjustments?: number;
    notes?: string | null;
  }): Promise<PayrollRow> {
    const { data, error } = await this.sb.rpc('admin_calculate_salesman_payroll', {
      p_salesman_profile_id: input.salesmanId,
      p_month: payrollMonthStart(input.month),
      p_adjustments: input.adjustments ?? 0,
      p_notes: input.notes ?? null,
    });
    if (error) throwRpcError(error, 'Could not calculate payroll');
    return this.mapPayrollRpcRow(data as unknown as Row, input.salesmanId);
  }

  async approveSalesmanPayroll(payrollId: string): Promise<PayrollRow> {
    const { data, error } = await this.sb.rpc('admin_approve_salesman_payroll', {
      p_payroll_id: payrollId,
    });
    if (error) throwRpcError(error, 'Could not approve payroll');
    const row = data as unknown as Row;
    return this.mapPayrollRpcRow(row, str(row['salesman_profile_id']));
  }

  async markSalesmanPayrollPaid(input: {
    payrollId: string;
    paymentMethod: PayrollPaymentMethod;
    paymentReference?: string | null;
  }): Promise<PayrollRow> {
    const { data, error } = await this.sb.rpc(
      'admin_mark_salesman_payroll_paid',
      {
        p_payroll_id: input.payrollId,
        p_payment_method: input.paymentMethod,
        p_payment_reference: input.paymentReference ?? null,
        p_paid_at: null,
      },
    );
    if (error) throwRpcError(error, 'Could not mark payroll paid');
    const row = data as unknown as Row;
    return this.mapPayrollRpcRow(row, str(row['salesman_profile_id']));
  }

  async setSalesmanPayrollAdjustments(input: {
    payrollId: string;
    adjustments: number;
    notes?: string | null;
  }): Promise<PayrollRow> {
    const { data, error } = await this.sb.rpc(
      'admin_set_salesman_payroll_adjustments',
      {
        p_payroll_id: input.payrollId,
        p_adjustments: input.adjustments,
        p_notes: input.notes ?? null,
      },
    );
    if (error) throwRpcError(error, 'Could not update payroll adjustments');
    const row = data as unknown as Row;
    return this.mapPayrollRpcRow(row, str(row['salesman_profile_id']));
  }

  private async mapPayrollRpcRow(
    row: Row,
    salesmanId: string,
  ): Promise<PayrollRow> {
    const { data: profile } = await this.sb
      .from('profiles')
      .select('display_name')
      .eq('id', salesmanId)
      .maybeSingle();
    return mapPayrollRow({
      id: str(row['id']),
      salesman_profile_id: str(row['salesman_profile_id']),
      salesman_name: profile?.display_name
        ? str(profile.display_name)
        : 'Salesman',
      payroll_month: str(row['payroll_month']),
      earning_model: str(row['earning_model']),
      base_salary: num(row['base_salary']),
      unpaid_leave_days: num(row['unpaid_leave_days']),
      unpaid_deduction: num(row['unpaid_deduction']),
      earned_commission: num(row['earned_commission']),
      daily_allowance: num(row['daily_allowance']),
      other_allowance: num(row['other_allowance']),
      adjustments: num(row['adjustments']),
      total_amount: num(row['total_amount']),
      status: str(row['status']),
      paid_at: row['paid_at'] ? str(row['paid_at']) : null,
      payment_method: row['payment_method'] ? str(row['payment_method']) : null,
      payment_reference: row['payment_reference']
        ? str(row['payment_reference'])
        : null,
      notes: row['notes'] ? str(row['notes']) : null,
      calculated_at: str(row['calculated_at']),
    });
  }

  /**
   * Records that admin shared the Customer App link (WhatsApp etc).
   * Does not activate the customer — OTP login is still required.
   */
  async recordCustomerAppLinkSent(shopId: string): Promise<void> {
    const { error } = await this.sb.rpc('record_customer_app_link_sent', {
      p_shop_id: shopId,
    });
    if (error) throw error;
  }

  async updateCustomerPrimaryContact(
    shopId: string,
    input: {
      ownerName: string;
      ownerMobile: string;
      ownerEmail?: string;
      acknowledgeActivatedChange?: boolean;
    },
  ): Promise<{
    contactMobile: string;
    linkedLoginMobile: string | null;
    hasDigitalAccess: boolean;
    mobileChanged: boolean;
    contactMatchesLogin: boolean;
  }> {
    const { data, error } = await this.sb.rpc(
      'admin_update_shop_primary_contact',
      {
        p_shop_id: shopId,
        p_name: input.ownerName,
        p_mobile: input.ownerMobile,
        p_email: input.ownerEmail ?? null,
        p_acknowledge_activated_change:
          input.acknowledgeActivatedChange ?? false,
      },
    );
    if (error) throw error;
    const row = (data ?? {}) as Record<string, unknown>;
    return {
      contactMobile: str(row['contactMobile']),
      linkedLoginMobile: row['linkedLoginMobile']
        ? str(row['linkedLoginMobile'])
        : null,
      hasDigitalAccess: row['hasDigitalAccess'] === true,
      mobileChanged: row['mobileChanged'] === true,
      contactMatchesLogin: row['contactMatchesLogin'] !== false,
    };
  }

  /**
   * Legacy token invitation — optional fallback. Primary path is mobile OTP.
   */
  async sendCustomerInvitation(
    shopId: string,
    mobile?: string | null,
  ): Promise<CustomerInvitationResult> {
    let normalizedMobile: string;

    if (mobile != null && mobile.trim() !== '') {
      const { data, error } = await this.sb.rpc('normalize_mobile', {
        p_mobile: mobile.trim(),
      });
      if (error) throw error;
      normalizedMobile = str(data);
    } else {
      const { data: contact, error: contactError } = await this.sb
        .from('shop_contacts')
        .select('mobile')
        .eq('shop_id', shopId)
        .eq('is_primary', true)
        .limit(1)
        .maybeSingle();
      if (contactError) throw contactError;
      if (!contact?.mobile) {
        throw new Error('No mobile available for invitation');
      }
      normalizedMobile = contact.mobile;
    }

    const expire = await this.sb
      .from('shop_invitations')
      .update({ status: 'EXPIRED' })
      .eq('shop_id', shopId)
      .eq('status', 'PENDING');
    if (expire.error) throw expire.error;

    const token = generateInvitationToken();
    const expiresAt = new Date(
      Date.now() + 14 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const insert = await this.sb
      .from('shop_invitations')
      .insert({
        shop_id: shopId,
        mobile: normalizedMobile,
        token,
        status: 'PENDING',
        expires_at: expiresAt,
      })
      .select('id')
      .single();
    if (insert.error) throw insert.error;

    const { data: shop, error: shopError } = await this.sb
      .from('shops')
      .select('lifecycle_status')
      .eq('id', shopId)
      .single();
    if (shopError) throw shopError;

    if (str(shop?.lifecycle_status) === 'LEAD') {
      const update = await this.sb
        .from('shops')
        .update({
          lifecycle_status: 'INVITED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', shopId);
      if (update.error) throw update.error;
    }

    return {
      invitationId: str(insert.data.id),
      shopId,
      mobile: normalizedMobile,
      token,
      expiresAt,
    };
  }

  // ─── Orders ─────────────────────────────────────────────────────────

  async ordersSnapshot(): Promise<OrdersSnapshot> {
    const { data: orders, error: ordersError } = await this.sb
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (ordersError) throw ordersError;

    if (!orders?.length) {
      return {
        generatedAtLabel: formatDateTime(new Date().toISOString()),
        kpis: [
          {
            id: 'active',
            label: 'All Active Orders',
            value: '0',
            hint: 'In progress through delivery and payment',
            href: '/orders?preset=active',
          },
          {
            id: 'awaiting_approval',
            label: 'Awaiting Approval',
            value: '0',
            hint: 'Orders waiting for your approval',
            href: '/orders?preset=awaiting_approval',
          },
          {
            id: 'processing',
            label: 'Processing',
            value: '0',
            hint: 'Invoice or packing in progress',
            href: '/orders?preset=processing',
          },
          {
            id: 'ready_dispatch',
            label: 'Ready for Dispatch',
            value: '0',
            hint: 'Packed orders ready to leave',
            href: '/orders?preset=ready_dispatch',
          },
          {
            id: 'needs_attention',
            label: 'Needs Attention',
            value: '0',
            hint: 'Orders requiring manual action',
            subtitle: 'No orders need action right now',
            href: '/orders?preset=needs_attention',
          },
        ],
        rows: [],
        salesRows: [],
        filterOptions: {
          statuses: [{ value: 'all', label: 'All statuses' }],
          payments: [{ value: 'all', label: 'All payments' }],
          salesmen: [{ value: 'all', label: 'All salesmen' }],
          warehouses: [{ value: 'all', label: 'All areas' }],
        },
      };
    }

    const shopIds = [
      ...new Set((orders as unknown as Row[]).map((o) => str(o['shop_id']))),
    ];
    const { data: shops } = await this.sb
      .from('shops')
      .select('id, trade_name, service_area_id')
      .in('id', shopIds)
      .is('deleted_at', null);
    const shopMap = new Map(
      (shops ?? []).map((s) => [
        str((s as unknown as Row)['id']),
        str((s as unknown as Row)['trade_name']),
      ]),
    );

    const { data: contacts } = await this.sb
      .from('shop_contacts')
      .select('shop_id, mobile, is_primary')
      .in('shop_id', shopIds);
    const mobileMap = new Map<string, string>();
    for (const c of (contacts ?? []) as Row[]) {
      const sid = str(c['shop_id']);
      if (!mobileMap.has(sid) || c['is_primary']) {
        mobileMap.set(sid, str(c['mobile']));
      }
    }

    const { data: profiles } = await this.sb
      .from('profiles')
      .select('id, display_name, mobile');
    const profileMap = new Map(
      (profiles ?? []).map((pr) => [pr.id, str(pr.display_name)]),
    );
    const profileMobileMap = new Map(
      (profiles ?? []).map((pr) => [pr.id, str(pr.mobile)]),
    );

    const { data: areas } = await this.sb
      .from('service_areas')
      .select('id, name');
    const areaMap = new Map(
      (areas ?? []).map((a) => [
        str((a as unknown as Row)['id']),
        str((a as unknown as Row)['name']),
      ]),
    );
    const shopAreaMap = new Map(
      (shops ?? []).map((s) => [
        str((s as unknown as Row)['id']),
        areaMap.get(str((s as unknown as Row)['service_area_id'])) ?? '—',
      ]),
    );

    const orderIds = (orders as unknown as Row[]).map((o) => str(o['id']));
    const { data: payments } = await this.sb
      .from('payments')
      .select('order_id, status, amount')
      .in('order_id', orderIds);
    const paymentMap = new Map<string, { status: string; amount: number }>();
    for (const p of (payments ?? []) as Row[]) {
      paymentMap.set(str(p['order_id']), {
        status: str(p['status']),
        amount: num(p['amount']),
      });
    }

    const rows: OrderListRow[] = (orders as unknown as Row[]).map((o) => {
      const oid = str(o['id']);
      const status = str(o['status']);
      const shopId = str(o['shop_id']);
      const pay = paymentMap.get(oid);
      const amount = num(o['total']);
      const paymentStatus = paymentStatusFromDb(pay?.status ?? null);
      const fulfillmentStatus = mapDbOrderStatusToFulfillment(status);
      const invoiceNumber = str(o['invoice_number']) || undefined;
      return {
        id: oid,
        orderCode: shortCode(oid, 'GA'),
        customerName: shopMap.get(shopId) ?? '-',
        customerMobile: mobileMap.get(shopId),
        orderValueLabel: formatInr(amount),
        orderValueAmount: amount,
        paymentStatus,
        fulfillmentStatus,
        deliveryStatus: deliveryStatusFromOrder(status),
        salesmanName: profileMap.get(str(o['created_by_profile_id'])) ?? '-',
        salesmanMobile: profileMobileMap.get(str(o['created_by_profile_id'])),
        warehouseName: shopAreaMap.get(shopId) ?? '-',
        updatedAtLabel: formatDateTime(str(o['updated_at'])),
        placedAtLabel: formatDateTime(str(o['created_at'])),
        placedAtIso: str(o['created_at']),
        updatedAtIso: str(o['updated_at']),
        invoiceNumber,
        dbStatus: status,
      };
    });

    const activeCount = rows.filter(
      (r) =>
        r.fulfillmentStatus !== 'CANCELLED' &&
        r.fulfillmentStatus !== 'DELIVERY_FAILED' &&
        !r.saleId,
    ).length;
    const awaitingApprovalCount = rows.filter(
      (r) =>
        r.dbStatus === 'DRAFT_ASSISTED' ||
        r.dbStatus === 'AWAITING_CUSTOMER_CONFIRMATION',
    ).length;
    const processingCount = rows.filter(
      (r) =>
        r.dbStatus === 'PROCESSING' ||
        r.fulfillmentStatus === 'PACKING' ||
        r.fulfillmentStatus === 'STOCK_RESERVED' ||
        (r.fulfillmentStatus === 'CONFIRMED' &&
          r.dbStatus !== 'DRAFT_ASSISTED' &&
          r.dbStatus !== 'AWAITING_CUSTOMER_CONFIRMATION'),
    ).length;
    const readyDispatchCount = rows.filter(
      (r) => r.fulfillmentStatus === 'READY_FOR_DISPATCH',
    ).length;

    const { data: salesData, error: salesErr } = await this.sb
      .from('sales')
      .select('id, order_id, invoice_number, converted_at, total');
    if (salesErr) throwRpcError(salesErr, 'Could not load sales register');
    const saleByOrder = new Map(
      ((salesData ?? []) as Row[]).map((s) => [
        str(s['order_id']),
        {
          id: str(s['id']),
          invoiceNumber: str(s['invoice_number']),
          convertedAt: str(s['converted_at']),
          total: num(s['total']),
        },
      ]),
    );
    for (const row of rows) {
      const sale = saleByOrder.get(row.id);
      if (sale) {
        row.saleId = sale.id;
        row.saleInvoiceNumber = sale.invoiceNumber;
        row.saleConvertedAtIso = sale.convertedAt;
        row.saleConvertedAtLabel = formatDateTime(sale.convertedAt);
        row.orderValueAmount = sale.total;
        row.orderValueLabel = formatInr(sale.total);
      }
    }
    const salesRows = rows
      .filter((r) => Boolean(r.saleId))
      .sort((a, b) =>
        (b.saleConvertedAtIso ?? '').localeCompare(a.saleConvertedAtIso ?? ''),
      );

    const statuses = [
      { value: 'all', label: 'All statuses' },
      ...[...new Set(rows.map((r) => r.fulfillmentStatus))].map((v) => ({
        value: v,
        label: v.replace(/_/g, ' '),
      })),
    ];
    const paymentOpts = [
      { value: 'all', label: 'All payments' },
      { value: 'PAID', label: 'Paid' },
      { value: 'UNPAID', label: 'Unpaid' },
      { value: 'PENDING', label: 'Pending' },
      { value: 'PARTIAL', label: 'Partial' },
    ];
    const salesmenOpts = [
      { value: 'all', label: 'All salesmen' },
      ...[...new Set(rows.map((r) => r.salesmanName).filter((n) => n !== '—'))].map(
        (v) => ({ value: v, label: v }),
      ),
    ];
    const warehouseOpts = [
      { value: 'all', label: 'All areas' },
      ...[
        ...new Set(rows.map((r) => r.warehouseName).filter((n) => n !== '—')),
      ].map((v) => ({ value: v, label: v })),
    ];

    const attentionCount = 0;

    return {
      generatedAtLabel: formatDateTime(new Date().toISOString()),
      kpis: [
        {
          id: 'active',
          label: 'All Active Orders',
          value: `${activeCount}`,
          hint: 'In progress through delivery and payment',
          href: '/orders?preset=active',
        },
        {
          id: 'awaiting_approval',
          label: 'Awaiting Approval',
          value: `${awaitingApprovalCount}`,
          hint: 'Orders waiting for your approval',
          tone: awaitingApprovalCount > 0 ? 'warning' : 'default',
          href: '/orders?preset=awaiting_approval',
        },
        {
          id: 'processing',
          label: 'Processing',
          value: `${processingCount}`,
          hint: 'Invoice or packing in progress',
          tone: processingCount > 0 ? 'default' : 'default',
          href: '/orders?preset=processing',
        },
        {
          id: 'ready_dispatch',
          label: 'Ready for Dispatch',
          value: `${readyDispatchCount}`,
          hint: 'Packed orders ready to leave',
          tone: readyDispatchCount > 0 ? 'positive' : 'default',
          href: '/orders?preset=ready_dispatch',
        },
        {
          id: 'needs_attention',
          label: 'Needs Attention',
          value: `${attentionCount}`,
          hint: 'Orders requiring manual action',
          subtitle: 'No orders need action right now',
          tone: 'default',
          href: '/orders?preset=needs_attention',
        },
      ],
      rows,
      salesRows,
      filterOptions: {
        statuses,
        payments: paymentOpts,
        salesmen: salesmenOpts,
        warehouses: warehouseOpts,
      },
    };
  }

  async orderDetail(id: string): Promise<OrderDetail | null> {
    const { data: order } = await this.sb
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();
    if (!order) return null;
    const o = order as unknown as Row;

    const [
      shopRes,
      profilesRes,
      linesRes,
      eventsRes,
      paymentRowsRes,
      contactsRes,
      areasRes,
      stopRes,
      settingsRes,
      deliveryStaffRes,
      saleRes,
    ] = await Promise.all([
      this.sb
        .from('shops')
        .select(
          'id, trade_name, legal_name, delivery_address_line, delivery_city, delivery_state, delivery_pin_code, service_area_id',
        )
        .eq('id', str(o['shop_id']))
        .maybeSingle(),
      this.sb.from('profiles').select('id, display_name, mobile, roles'),
      this.sb.from('order_lines').select('*').eq('order_id', id),
      this.sb
        .from('order_events')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: true }),
      this.sb.from('payments').select('*').eq('order_id', id),
      this.sb
        .from('shop_contacts')
        .select('mobile, name, is_primary')
        .eq('shop_id', str(o['shop_id'])),
      this.sb.from('service_areas').select('id, name'),
      this.sb
        .from('route_stops')
        .select('id, route_id, status')
        .eq('order_id', id)
        .limit(1)
        .maybeSingle(),
      this.sb.from('settings').select('setting_key, setting_value').is('deleted_at', null),
      this.sb
        .from('profiles')
        .select('id, display_name, mobile')
        .contains('roles', ['DELIVERY'])
        .eq('is_active', true),
      this.sb
        .from('sales')
        .select(
          'id, invoice_number, converted_at, converted_by_profile_id, subtotal, discount, total, currency, status',
        )
        .eq('order_id', id)
        .maybeSingle(),
    ]);

    if (settingsRes.error) {
      throwRpcError(settingsRes.error, 'Could not load company settings for invoice');
    }
    if (saleRes.error) {
      throwRpcError(saleRes.error, 'Could not load sale for order');
    }

    const shop = shopRes.data as unknown as Row | null;
    const profiles = (profilesRes.data ?? []) as Row[];
    const profileMap = new Map(
      profiles.map((pr) => [str(pr['id']), str(pr['display_name']) || 'Staff']),
    );

    const areaMap = new Map(
      ((areasRes.data ?? []) as Row[]).map((a) => [str(a['id']), str(a['name'])]),
    );
    const serviceAreaId = shop ? str(shop['service_area_id']) : '';
    const serviceAreaName = serviceAreaId
      ? areaMap.get(serviceAreaId) ?? '—'
      : '—';

    const contacts = (contactsRes.data ?? []) as Row[];
    const primaryContact =
      contacts.find((c) => Boolean(c['is_primary'])) ?? contacts[0];
    const customerMobile = primaryContact
      ? str(primaryContact['mobile'])
      : '—';

    const deliveryAddress = shop
      ? [
          str(shop['delivery_address_line']),
          str(shop['delivery_city']),
          str(shop['delivery_state']),
          str(shop['delivery_pin_code']),
        ]
          .filter(Boolean)
          .join(', ')
      : '—';

    const lines = (linesRes.data ?? []) as Row[];
    const lineUnitById = new Map(
      lines.map((l) => [str(l['id']), str(l['selling_unit_snapshot'])] as const),
    );
    let lineItems: OrderLineItem[] = lines.map((l) => {
      const qty = num(l['quantity']);
      const unit = num(l['agreed_unit_price']);
      const lineTotal = num(
        l['line_total'] ?? Math.round(qty * unit * 100) / 100,
      );
      const sellingUnit = str(l['selling_unit_snapshot']);
      return {
        id: str(l['id']),
        skuId: str(l['sku_id']) || undefined,
        productName: str(l['product_name_snapshot']) || str(l['sku_name_snapshot']),
        skuCode: str(l['sku_code_snapshot']) || '—',
        skuName: str(l['sku_name_snapshot']) || '—',
        quantityLabel: formatQuantityWithUnit(
          qty,
          humanizeSellingUnit(sellingUnit),
        ),
        unitPriceLabel: formatInrPrecise(unit),
        discountLabel: formatInr(0),
        lineTotalLabel: formatInr(lineTotal),
        quantity: qty,
        unitPrice: unit,
        lineTotal,
      };
    });

    const status = str(o['status']);
    const fulfillment = mapDbOrderStatusToFulfillment(status);
    const paymentRow = ((paymentRowsRes.data ?? []) as Row[])[0];
    let paymentStatus = paymentStatusFromDb(
      paymentRow ? str(paymentRow['status']) : null,
    );
    const deliveryStatus = deliveryStatusFromOrder(status);
    let totalAmount = num(o['total']);
    let subtotal = num(o['subtotal']) || totalAmount;
    const adjustments = num(o['adjustments']);
    let discount = adjustments < 0 ? Math.abs(adjustments) : 0;
    let collected =
      paymentRow && str(paymentRow['status']) === 'PAID'
        ? num(paymentRow['amount'])
        : 0;

    const methodIntent = paymentRow
      ? str(paymentRow['method_intent'] || paymentRow['collection_method'])
      : '';
    const methodLabel =
      methodIntent === 'PAY_ONLINE_NOW'
        ? 'Pay Online'
        : methodIntent.includes('UPI')
          ? 'UPI on Delivery'
          : methodIntent.includes('CARD')
            ? 'Card on Delivery'
            : 'Cash on Delivery';

    let paymentSummary: OrderPaymentSummary = {
      methodLabel,
      status: paymentStatus,
      subtotalLabel: formatInr(subtotal),
      discountLabel: formatInr(discount),
      adjustmentsLabel: formatInr(adjustments),
      totalLabel: formatInr(totalAmount),
      collectedLabel: formatInr(collected),
      outstandingLabel: formatInr(Math.max(totalAmount - collected, 0)),
      subtotal,
      discount,
      total: totalAmount,
      collected,
      outstanding: Math.max(totalAmount - collected, 0),
    };

    const saleRow = saleRes.data
      ? (saleRes.data as unknown as Row)
      : null;

    let salePaymentMeta:
      | {
          paymentStatus: PaymentStatusVm;
          paymentAmount: number;
          collectedAtLabel?: string;
        }
      | undefined;

    if (saleRow) {
      const saleId = str(saleRow['id']);
      const [saleItemsRes, salePayRes] = await Promise.all([
        this.sb.from('sale_items').select('*').eq('sale_id', saleId),
        this.sb
          .from('sales_payments')
          .select('status, amount, collected_at, payment_id')
          .eq('sale_id', saleId)
          .maybeSingle(),
      ]);
      if (saleItemsRes.error) {
        throwRpcError(saleItemsRes.error, 'Could not load sale items for invoice');
      }
      if (salePayRes.error) {
        throwRpcError(salePayRes.error, 'Could not load sale payment for invoice');
      }

      const saleItems = (saleItemsRes.data ?? []) as Row[];
      lineItems = mapSaleItemsToOrderLines(
        saleItems.map((item) => {
          const orderLineId = str(item['order_line_id']);
          return {
            id: str(item['id']),
            product_name: str(item['product_name']) || null,
            sku_code: str(item['sku_code']) || null,
            sku_name: str(item['sku_name']) || null,
            quantity: num(item['quantity']),
            unit_price: num(item['unit_price']),
            discount: num(item['discount']),
            line_total: num(item['line_total']),
            selling_unit: orderLineId
              ? lineUnitById.get(orderLineId) ?? null
              : null,
          };
        }),
      );

      subtotal = num(saleRow['subtotal']);
      discount = num(saleRow['discount']);
      totalAmount = num(saleRow['total']);

      const salePay = salePayRes.data
        ? (salePayRes.data as unknown as Row)
        : null;
      paymentSummary = mapSaleToPaymentSummary({
        sale: {
          subtotal,
          discount,
          total: totalAmount,
        },
        salePayment: salePay
          ? {
              status: str(salePay['status']),
              amount: num(salePay['amount']),
              collected_at: str(salePay['collected_at']) || null,
            }
          : null,
        methodLabel,
      });
      paymentStatus = paymentSummary.status;
      collected = paymentSummary.collected ?? 0;
      if (salePay) {
        salePaymentMeta = {
          paymentStatus: paymentSummary.status,
          paymentAmount: num(salePay['amount']),
          collectedAtLabel: salePay['collected_at']
            ? formatDateTime(str(salePay['collected_at']))
            : undefined,
        };
      }
    }

    const events = (eventsRes.data ?? []) as Row[];
    const stamps: Partial<Record<WholesaleFulfillmentStatus, string>> = {};
    const actors: Partial<Record<WholesaleFulfillmentStatus, string>> = {};
    for (const e of events) {
      const note = str(e['note']);
      // Audit-only notes reuse current to_status — do not stamp fulfillment from them.
      if (
        /invoice\s*printed/i.test(note) ||
        /invoice\s*created/i.test(note) ||
        /NEEDS_ATTENTION/i.test(note) ||
        /order lines updated/i.test(note)
      ) {
        continue;
      }
      const mapped = mapDbOrderStatusToFulfillment(str(e['to_status']));
      stamps[mapped] = formatDateTime(str(e['created_at']));
      actors[mapped] =
        profileMap.get(str(e['actor_profile_id'])) ?? 'System';
    }
    if (!stamps.CONFIRMED) {
      stamps.CONFIRMED = formatDateTime(str(o['created_at']));
      actors.CONFIRMED =
        profileMap.get(str(o['created_by_profile_id'])) ?? 'System';
    }

    let routeId: string | undefined;
    let routeLabel: string | undefined;
    let deliveryPersonId: string | undefined;
    let deliveryPersonName: string | undefined;
    let scheduledDate: string | null = null;
    let timeSlotLabel: string | null = null;
    let vehicleLabel: string | null = null;
    let vehicleId: string | null = null;
    let progressLabel: string | null = null;
    let codCustodyStatus: string | null = null;
    let codCustodyLabel: string | null = null;
    let notificationHonesty: string | null = null;
    let windowLabel = '—';

    const stop = stopRes.data as unknown as Row | null;
    if (stop) {
      routeId = str(stop['route_id']);
      const { data: route } = await this.sb
        .from('delivery_routes')
        .select(
          'id, route_date, status, assigned_delivery_profile_id, vehicle_id, time_slot_id',
        )
        .eq('id', routeId)
        .maybeSingle();
      if (route) {
        const r = route as unknown as Row;
        scheduledDate = str(r['route_date']) || null;
        routeLabel = `Route ${str(r['route_date'])} · ${str(r['status'])}`;
        deliveryPersonId = str(r['assigned_delivery_profile_id']) || undefined;
        if (deliveryPersonId) {
          deliveryPersonName = profileMap.get(deliveryPersonId);
        }
        vehicleId = str(r['vehicle_id']) || null;
        if (vehicleId) {
          const { data: veh } = await this.sb
            .from('vehicles')
            .select('vehicle_number')
            .eq('id', vehicleId)
            .maybeSingle();
          if (veh) vehicleLabel = str((veh as unknown as Row)['vehicle_number']);
        }
        const slotId = str(r['time_slot_id']);
        if (slotId) {
          const { data: slot } = await this.sb
            .from('delivery_time_slots')
            .select('label')
            .eq('id', slotId)
            .maybeSingle();
          if (slot) {
            timeSlotLabel = str((slot as unknown as Row)['label']);
            windowLabel = timeSlotLabel;
          }
        }
        const { data: routeStops } = await this.sb
          .from('route_stops')
          .select('id, status')
          .eq('route_id', routeId);
        const stops = (routeStops ?? []) as Row[];
        const total = stops.length;
        const done = stops.filter((s) => str(s['status']) === 'COMPLETED').length;
        const current = stops.findIndex((s) => str(s['id']) === str(stop['id'])) + 1;
        const remaining = stops.filter(
          (s) =>
            str(s['status']) === 'PENDING' || str(s['status']) === 'IN_PROGRESS',
        ).length;
        progressLabel = `${done}/${total} delivered · stop ${current || '—'} · ${remaining} remaining`;
      }
    }

    const { data: custody } = await this.sb
      .from('delivery_cod_custody')
      .select('status, amount')
      .eq('order_id', id)
      .maybeSingle();
    if (custody) {
      const c = custody as unknown as Row;
      codCustodyStatus = str(c['status']);
      codCustodyLabel = `${str(c['status']).replace(/_/g, ' ')} · ${formatInr(num(c['amount']))}`;
    }

    const { data: notif } = await this.sb
      .from('delivery_notification_events')
      .select('provider_configured')
      .eq('order_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (notif) {
      notificationHonesty = notificationHonestyLabel(
        Boolean((notif as unknown as Row)['provider_configured']),
      );
    } else {
      const configured = await deliveryH5.deliveryProviderConfigured(this.sb);
      notificationHonesty = notificationHonestyLabel(configured);
    }

    const settingsMap = new Map<string, unknown>();
    for (const row of ((settingsRes.data ?? []) as unknown as Row[])) {
      settingsMap.set(str(row['setting_key']), row['setting_value']);
    }
    const companyData = settingsMap.get('company') as
      | Record<string, unknown>
      | undefined;

    const availableDeliveryStaff: DeliveryStaffOption[] = (
      (deliveryStaffRes.data ?? []) as Row[]
    ).map((d) => ({
      id: str(d['id']),
      name: str(d['display_name']),
      mobileLabel: str(d['mobile']) || undefined,
    }));

    const activity: OrderActivityRow[] = events.map((e) => {
      const toStatus = str(e['to_status']);
      const fromStatus = str(e['from_status']);
      const note = str(e['note']);
      let actionLabel = toStatus
        ? toStatus.replace(/_/g, ' ')
        : 'Status update';
      if (/invoice\s*created/i.test(note)) actionLabel = 'Invoice Created';
      else if (/invoice\s*printed/i.test(note)) actionLabel = 'Invoice Printed';
      else if (/delivery confirmed/i.test(note)) actionLabel = 'Delivered';
      else if (/packing started/i.test(note) || toStatus === 'PROCESSING') {
        actionLabel = 'Packing Started';
      } else if (/packed/i.test(note) && toStatus === 'READY_FOR_DISPATCH') {
        actionLabel = 'Packed';
      } else if (
        /assigned to delivery/i.test(note) ||
        toStatus === 'ASSIGNED_TO_ROUTE'
      ) {
        actionLabel = 'Delivery Assigned';
      } else if (/converted to sale/i.test(note) || /sale converted/i.test(note)) {
        actionLabel = 'Converted to Sale';
      } else if (/NEEDS_ATTENTION/i.test(note)) {
        actionLabel = 'Needs Attention';
      } else if (/order lines updated/i.test(note)) {
        actionLabel = 'Lines Updated';
      }
      return {
        id: str(e['id']),
        atLabel: formatDateTime(str(e['created_at'])),
        actorLabel: profileMap.get(str(e['actor_profile_id'])) ?? 'System',
        actionLabel,
        detail:
          note ||
          (fromStatus
            ? `${fromStatus.replace(/_/g, ' ')} → ${toStatus.replace(/_/g, ' ')}`
            : ''),
        occurredAt: str(e['created_at']),
      };
    });

    // Append payment received if paid.
    if (paymentRow && str(paymentRow['status']) === 'PAID') {
      activity.push({
        id: `pay-${str(paymentRow['id'])}`,
        atLabel: formatDateTime(
          str(paymentRow['paid_at'] ?? paymentRow['updated_at']),
        ),
        actorLabel: 'System',
        actionLabel: 'Payment Received',
        detail: formatInr(num(paymentRow['amount'])),
        occurredAt: str(paymentRow['paid_at'] ?? paymentRow['updated_at']),
      });
    }

    const sortedActivity = activity.sort((a, b) =>
      (a.occurredAt ?? '').localeCompare(b.occurredAt ?? ''),
    );
    const invoicePrinted = sortedActivity.some(
      (a) => a.actionLabel === 'Invoice Printed',
    );
    const invoiceNumber = str(o['invoice_number']) || undefined;
    const invoiceCreatedAt = str(o['invoice_created_at']) || undefined;
    const invoiceCreatedEvent = sortedActivity.find((a) =>
      /invoice\s*created/i.test(a.detail || a.actionLabel),
    );

    const paymentPaid = paymentStatus === 'PAID';
    const saleCompleted = Boolean(saleRow);
    const invoicePrintedRow = sortedActivity.find(
      (a) => a.actionLabel === 'Invoice Printed',
    );
    const attentionFromEvents = orderNeedsAttentionFromEvents(
      sortedActivity.map((a) => ({
        detail: a.detail,
        actionLabel: a.actionLabel,
      })),
    );
    const unassignedReady =
      status === 'READY_FOR_DISPATCH' && !deliveryPersonId;
    const saleConversionPending =
      status === 'DELIVERED' &&
      paymentStatus === 'PAID' &&
      !saleRow;
    const needsAttention =
      attentionFromEvents || unassignedReady || saleConversionPending;
    const attentionReason = unassignedReady
      ? 'Assignment pending'
      : saleConversionPending
        ? 'Sale conversion pending'
        : attentionFromEvents
          ? 'Needs attention'
          : undefined;

    const timeline = buildOrderTimeline(fulfillment, stamps, actors, {
      paymentPaid,
      saleCompleted,
      paymentAt: paymentPaid
        ? formatDateTime(
            str(paymentRow?.['paid_at'] ?? paymentRow?.['updated_at'] ?? ''),
          )
        : undefined,
      saleAt: saleRow
        ? formatDateTime(str(saleRow['converted_at']))
        : undefined,
      paymentActor: 'System',
      saleActor: saleRow
        ? profileMap.get(str(saleRow['converted_by_profile_id'])) ?? 'Admin'
        : undefined,
      createdAt: formatDateTime(str(o['created_at'])),
      createdActor:
        profileMap.get(str(o['created_by_profile_id'])) ?? 'System',
      invoiceCreatedAt:
        invoiceCreatedAt ? formatDateTime(invoiceCreatedAt) : undefined,
      invoiceCreatedActor:
        invoiceCreatedEvent?.actorLabel ?? invoicePrintedRow?.actorLabel,
      hasInvoice: Boolean(invoiceNumber),
      needsAttention,
    });

    const created = new Date(str(o['created_at']));
    const shopName = shop ? str(shop['trade_name']) : '—';
    const salesmanId = str(o['created_by_profile_id']);

    return {
      id: str(o['id']),
      orderCode: shortCode(str(o['id']), 'GA'),
      customerName: shopName,
      shopName,
      customerMobile,
      deliveryAddress,
      salesmanName: profileMap.get(salesmanId) ?? '—',
      salesmanMobile: (() => {
        const pr = profiles.find((p) => str(p['id']) === salesmanId);
        return pr ? str(pr['mobile']) || undefined : undefined;
      })(),
      salesmanEmployeeCode: salesmanId
        ? shortCode(salesmanId, 'EMP')
        : undefined,
      warehouseName: serviceAreaName,
      serviceAreaName,
      placedAtLabel: formatDateTime(str(o['created_at'])),
      placedDateLabel: formatDate(str(o['created_at'])),
      placedTimeLabel: Number.isNaN(created.getTime())
        ? '—'
        : created.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          }),
      updatedAtLabel: formatDateTime(str(o['updated_at'])),
      notes: undefined,
      dbStatus: status,
      fulfillmentStatus: fulfillment,
      paymentStatus,
      deliveryStatus,
      orderValueLabel: formatInr(totalAmount),
      invoicePrinted,
      invoiceNumber,
      invoiceCreatedAt,
      invoiceCreatedAtLabel: invoiceCreatedAt
        ? formatDateTime(invoiceCreatedAt)
        : undefined,
      needsAttention,
      attentionReason,
      lines: lineItems,
      timeline,
      workflowEvents: sortedActivity,
      payment: paymentSummary,
      delivery: {
        addressLabel: 'Delivery Address',
        addressText: deliveryAddress,
        windowLabel,
        routeLabel,
        routeId,
        warehouseName: serviceAreaName,
        deliveryStatus,
        deliveryPersonId,
        deliveryPersonName,
        serviceAreaId: serviceAreaId || undefined,
        serviceAreaName,
        challanLabel: undefined,
        scheduledDate,
        timeSlotLabel,
        vehicleLabel,
        vehicleId,
        progressLabel,
        codCustodyStatus,
        codCustodyLabel,
        notificationHonesty,
      },
      activity: sortedActivity,
      availableDeliveryStaff,
      sale: saleRow
        ? {
            id: str(saleRow['id']),
            invoiceNumber: str(saleRow['invoice_number']),
            convertedAtLabel: formatDateTime(str(saleRow['converted_at'])),
            subtotal: num(saleRow['subtotal']),
            discount: num(saleRow['discount']),
            total: num(saleRow['total']),
            currency: str(saleRow['currency']) || 'INR',
            ...(salePaymentMeta ?? {}),
          }
        : undefined,
      company: mapCompanySettingsToInvoiceCompany(companyData),
    };
  }

  /**
   * Convert a delivered + paid order into a completed sale via trusted RPC.
   * Atomic: sales + sale_items + sales_payments + orders.sale_id.
   */
  async convertOrderToSale(orderId: string): Promise<{
    saleId: string;
    invoiceNumber: string;
    convertedAt: string;
    alreadyConverted: boolean;
  }> {
    const { data, error } = await this.sb.rpc('admin_convert_order_to_sale', {
      p_order_id: orderId,
    });
    if (error) throwRpcError(error, 'Could not convert order to sale');
    const row = (data ?? {}) as Record<string, unknown>;
    return {
      saleId: str(row['saleId']),
      invoiceNumber: str(row['invoiceNumber']),
      convertedAt: str(row['convertedAt'] ?? new Date().toISOString()),
      alreadyConverted: Boolean(row['alreadyConverted']),
    };
  }

  /**
   * Assign (or reassign) a delivery person via trusted admin RPC.
   */
  async assignOrderDelivery(
    orderId: string,
    deliveryProfileId: string,
  ): Promise<void> {
    const { error } = await this.sb.rpc('admin_assign_order_delivery', {
      p_order_id: orderId,
      p_delivery_profile_id: deliveryProfileId,
    });
    if (error) throw error;
  }

  /**
   * Close a delivery route via trusted RPC `delivery_complete_route`.
   * Enforces open-stop validation — does not set COMPLETED via CRUD.
   */
  async completeDeliveryRoute(routeId: string): Promise<{
    routeId: string;
    completedDeliveries: number;
    failedDeliveries: number;
    codExpected: number;
    codCollected: number;
    codPending: number;
    closedAt: string;
  }> {
    const { data, error } = await this.sb.rpc('delivery_complete_route', {
      p_route_id: routeId,
    });
    if (error) throwRpcError(error, 'Could not close route');
    const row = (data ?? {}) as Record<string, unknown>;
    return {
      routeId: str(row['routeId'] ?? routeId),
      completedDeliveries: num(row['completedDeliveries']),
      failedDeliveries: num(row['failedDeliveries']),
      codExpected: num(row['codExpected']),
      codCollected: num(row['codCollected']),
      codPending: num(row['codPending']),
      closedAt: str(row['closedAt'] ?? new Date().toISOString()),
    };
  }

  /** Start route via delivery_start_route (DRAFT|PLANNED|IN_PROGRESS → IN_PROGRESS). */
  async startDeliveryRoute(routeId: string): Promise<void> {
    const { error } = await this.sb.rpc('delivery_start_route', {
      p_route_id: routeId,
    });
    if (error) throwRpcError(error, 'Could not start route');
  }

  /** Mark stop in progress via delivery_mark_stop_in_progress. */
  async markStopInProgress(stopId: string): Promise<void> {
    const { error } = await this.sb.rpc('delivery_mark_stop_in_progress', {
      p_stop_id: stopId,
    });
    if (error) throwRpcError(error, 'Could not mark stop in progress');
  }

  /** Collect COD via delivery_collect_cod. */
  async collectDeliveryCod(
    orderId: string,
    collectedAmount: number,
    collectionMethod: string = 'CASH_ON_DELIVERY',
  ): Promise<void> {
    const { error } = await this.sb.rpc('delivery_collect_cod', {
      p_order_id: orderId,
      p_collected_amount: collectedAmount,
      p_collection_method: collectionMethod,
    });
    if (error) throwRpcError(error, 'Could not collect COD');
  }

  /** Mark stop delivered via delivery_complete_stop (payment / OFD rules apply). */
  async completeDeliveryStop(
    stopId: string,
    options?: { notes?: string | null; collectCodAmount?: number | null },
  ): Promise<void> {
    const { error } = await this.sb.rpc('delivery_complete_stop', {
      p_stop_id: stopId,
      p_notes: options?.notes ?? null,
      p_photo_captured: false,
      p_signature_captured: false,
      p_collect_cod_amount: options?.collectCodAmount ?? null,
    });
    if (error) throwRpcError(error, 'Could not mark delivered');
  }

  /** Mark stop failed via delivery_fail_stop. */
  async failDeliveryStop(
    stopId: string,
    failureReason: string,
    notes?: string | null,
  ): Promise<void> {
    const { error } = await this.sb.rpc('delivery_fail_stop', {
      p_stop_id: stopId,
      p_failure_reason: failureReason,
      p_notes: notes ?? null,
      p_photo_captured: false,
    });
    if (error) throwRpcError(error, 'Could not mark failed');
  }

  /** Attach a packed order to the selected route. */
  async assignOrderToRoute(orderId: string, routeId: string): Promise<void> {
    const { error } = await this.sb.rpc('admin_assign_order_to_route', {
      p_order_id: orderId,
      p_route_id: routeId,
    });
    if (error) throwRpcError(error, 'Could not assign order to route');
  }

  /**
   * READY_FOR_DISPATCH orders in the route service area that are not yet on any route.
   */
  async listAssignableOrdersForRoute(
    routeId: string,
  ): Promise<DeliveryAssignableOrder[]> {
    const { data: route, error: routeErr } = await this.sb
      .from('delivery_routes')
      .select('id, service_area_id')
      .eq('id', routeId)
      .is('deleted_at', null)
      .maybeSingle();
    if (routeErr) throwRpcError(routeErr, 'Could not load route');
    if (!route) return [];

    const serviceAreaId = str((route as unknown as Row)['service_area_id']);
    const { data: stops } = await this.sb.from('route_stops').select('order_id');
    const assignedOrderIds = new Set(
      ((stops ?? []) as Row[]).map((s) => str(s['order_id'])),
    );

    const { data: orders, error: ordersErr } = await this.sb
      .from('orders')
      .select('id, total, status, shop_id')
      .eq('service_area_id', serviceAreaId)
      .eq('status', 'READY_FOR_DISPATCH')
      .order('created_at', { ascending: false })
      .limit(50);
    if (ordersErr) throwRpcError(ordersErr, 'Could not load assignable orders');

    const candidates = ((orders ?? []) as Row[]).filter(
      (o) => !assignedOrderIds.has(str(o['id'])),
    );
    const shopIds = [
      ...new Set(candidates.map((o) => str(o['shop_id'])).filter(Boolean)),
    ];
    const { data: shops } = shopIds.length
      ? await this.sb
          .from('shops')
          .select('id, trade_name')
          .in('id', shopIds)
          .is('deleted_at', null)
      : { data: [] as Row[] };
    const shopMap = new Map(
      ((shops ?? []) as Row[]).map((s) => [str(s['id']), str(s['trade_name'])]),
    );

    return candidates.map((o) => ({
      id: str(o['id']),
      orderCode: shortCode(str(o['id']), 'GA'),
      customerName: shopMap.get(str(o['shop_id'])) ?? '—',
      amountLabel: formatInr(num(o['total'])),
      statusLabel: 'Ready for Dispatch',
    }));
  }

  /** Confirm a pending/draft order → CONFIRMED via trusted RPC. */
  async confirmOrder(orderId: string): Promise<void> {
    const { error } = await this.sb.rpc('admin_advance_order_to', {
      p_order_id: orderId,
      p_to_status: 'CONFIRMED',
      p_note: 'Order confirmed',
    });
    if (error) throw error;
  }

  /** Record invoice printed — audit event only; does not change order status. */
  async recordInvoicePrinted(orderId: string): Promise<void> {
    const { error } = await this.sb.rpc('admin_record_invoice_printed', {
      p_order_id: orderId,
      p_note: 'Invoice printed',
    });
    if (error) throwRpcError(error, 'Could not record invoice printed');
  }

  /** Create pre-sale invoice number on the order (no status / stock change). */
  async createOrderInvoice(orderId: string): Promise<{
    orderId: string;
    invoiceNumber: string;
    invoiceCreatedAt: string;
    alreadyCreated: boolean;
  }> {
    const { data, error } = await this.sb.rpc('admin_create_order_invoice', {
      p_order_id: orderId,
    });
    if (error) throwRpcError(error, 'Could not create order invoice');
    const row = (data ?? {}) as Record<string, unknown>;
    return {
      orderId: str(row['orderId'] ?? orderId),
      invoiceNumber: str(row['invoiceNumber']),
      invoiceCreatedAt: str(
        row['invoiceCreatedAt'] ?? new Date().toISOString(),
      ),
      alreadyCreated: Boolean(row['alreadyCreated']),
    };
  }

  /** Start packing → PROCESSING. */
  async startPacking(orderId: string): Promise<void> {
    const { error } = await this.sb.rpc('admin_start_packing', {
      p_order_id: orderId,
    });
    if (error) throwRpcError(error, 'Could not start packing');
  }

  /**
   * Process order — existing RPC chain initiated by one admin action:
   * create invoice (if needed) → record print → start packing.
   */
  async processOrder(
    orderId: string,
    ctx: {
      hasInvoice: boolean;
      invoicePrinted: boolean;
      dbStatus: string;
    },
  ): Promise<void> {
    if (!ctx.hasInvoice) {
      await this.createOrderInvoice(orderId);
    }
    if (!ctx.invoicePrinted) {
      await this.recordInvoicePrinted(orderId);
    }
    if (ctx.dbStatus !== 'PROCESSING') {
      await this.startPacking(orderId);
    }
  }

  /**
   * Pack → READY_FOR_DISPATCH + try auto-assign.
   * Prefer this over markOrderPacked (advance-only).
   */
  async packOrder(orderId: string): Promise<{
    orderId: string;
    status: string;
    alreadyPacked?: boolean;
    autoAssign: PackAutoAssignResult;
  }> {
    const { data, error } = await this.sb.rpc('admin_pack_order', {
      p_order_id: orderId,
    });
    if (error) throwRpcError(error, 'Could not pack order');
    const row = (data ?? {}) as Record<string, unknown>;
    const auto = (row['autoAssign'] ?? {}) as Record<string, unknown>;
    return {
      orderId: str(row['orderId'] ?? orderId),
      status: str(row['status'] ?? 'READY_FOR_DISPATCH'),
      alreadyPacked:
        row['alreadyPacked'] === undefined
          ? undefined
          : Boolean(row['alreadyPacked']),
      autoAssign: {
        assigned: Boolean(auto['assigned']),
        alreadyAssigned: auto['alreadyAssigned']
          ? Boolean(auto['alreadyAssigned'])
          : undefined,
        needsAttention: auto['needsAttention']
          ? Boolean(auto['needsAttention'])
          : undefined,
        reason: auto['reason'] ? str(auto['reason']) : undefined,
        usesOwnVehicle: auto['usesOwnVehicle']
          ? Boolean(auto['usesOwnVehicle'])
          : undefined,
        routeId: auto['routeId'] ? str(auto['routeId']) : undefined,
        deliveryProfileId: auto['deliveryProfileId']
          ? str(auto['deliveryProfileId'])
          : undefined,
        vehicleId:
          auto['vehicleId'] === null || auto['vehicleId'] === undefined
            ? auto['vehicleId'] === null
              ? null
              : undefined
            : str(auto['vehicleId']),
        missingResources: Array.isArray(auto['missingResources'])
          ? ((auto['missingResources'] as unknown[]).map((x) => str(x)).filter(
              (x): x is DeliveryMissingResource =>
                x === 'drivers' ||
                x === 'vehicles' ||
                x === 'service_area' ||
                x === 'manual_assign',
            ) as DeliveryMissingResource[])
          : undefined,
      },
    };
  }

  /** Replace order lines before packing (trusted admin RPC). */
  async replaceOrderLines(
    orderId: string,
    lines: Array<{ skuId: string; quantity: number; unitPrice?: number }>,
  ): Promise<{
    orderId: string;
    lineCount: number;
    subtotal: number;
    total: number;
  }> {
    const { data, error } = await this.sb.rpc('admin_replace_order_lines', {
      p_order_id: orderId,
      p_lines: lines.map((l) => ({
        skuId: l.skuId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
    });
    if (error) throwRpcError(error, 'Could not update order lines');
    const row = (data ?? {}) as Record<string, unknown>;
    return {
      orderId: str(row['orderId'] ?? orderId),
      lineCount: num(row['lineCount']),
      subtotal: num(row['subtotal']),
      total: num(row['total']),
    };
  }

  /** Orders needing ops attention (assignment, exceptions, sale convert). */
  async listOrdersNeedingAttention(
    limit = 50,
  ): Promise<OrdersNeedingAttentionResult> {
    const { data, error } = await this.sb.rpc('admin_orders_needing_attention', {
      p_limit: limit,
    });
    if (error) throwRpcError(error, 'Could not load orders needing attention');
    const payload = (data ?? {}) as Record<string, unknown>;
    const raw = Array.isArray(payload['orders'])
      ? (payload['orders'] as Record<string, unknown>[])
      : [];
    const summaryRaw = Array.isArray(payload['summary'])
      ? (payload['summary'] as Record<string, unknown>[])
      : [];
    return {
      count: num(payload['count'] ?? raw.length),
      summary: summaryRaw.map((row) => ({
        reasonCode: str(row['reason_code'] ?? row['reasonCode']),
        count: num(row['count']),
      })),
      orders: raw.map((r) => ({
        orderId: str(r['order_id'] ?? r['orderId']),
        status: str(r['status']),
        total: num(r['total']),
        updatedAt: str(r['updated_at'] ?? r['updatedAt']),
        shopName: str(r['shop_name'] ?? r['shopName']),
        reasonCode: str(r['reason_code'] ?? r['reasonCode']),
        priority: num(r['priority']),
        severity: str(r['severity'] ?? '') || undefined,
        attentionDetail: str(r['attention_detail'] ?? r['attentionDetail'] ?? '') || undefined,
      })),
    };
  }

  /** @deprecated Prefer packOrder (admin_pack_order + auto-assign). */
  async markOrderPacked(orderId: string): Promise<void> {
    await this.packOrder(orderId);
  }

  /**
   * Confirm delivery via trusted RPCs only.
   * If an open route stop exists → delivery_complete_stop (updates stop + order).
   * Otherwise → admin_advance_order_to DELIVERED.
   * Never CRUD-updates route_stops.
   */
  async confirmOrderDelivery(
    orderId: string,
    source: 'delivery_boy' | 'customer' | 'admin' = 'admin',
  ): Promise<void> {
    const sourceLabel =
      source === 'customer'
        ? 'Customer confirmation'
        : source === 'delivery_boy'
          ? 'Delivery boy confirmation'
          : 'Admin confirmation';

    const { data: stop, error: stopErr } = await this.sb
      .from('route_stops')
      .select('id, status')
      .eq('order_id', orderId)
      .maybeSingle();
    if (stopErr) throwRpcError(stopErr, 'Could not load route stop');

    const stopRow = stop as unknown as Row | null;
    const stopStatus = stopRow ? str(stopRow['status']) : '';
    const openStop =
      stopRow &&
      (stopStatus === 'PENDING' || stopStatus === 'IN_PROGRESS');

    if (openStop) {
      const { error } = await this.sb.rpc('delivery_complete_stop', {
        p_stop_id: str(stopRow['id']),
        p_notes: `Delivery confirmed · ${sourceLabel}`,
        p_photo_captured: false,
        p_signature_captured: false,
        p_collect_cod_amount: null,
      });
      if (error) {
        const msg = error.message || '';
        if (msg.includes('PAID') || msg.includes('payment') || msg.includes('COD')) {
          throw new Error(
            'Payment must be received before marking Delivered. Use Payment Received / Collect COD first.',
          );
        }
        throwRpcError(error, 'Could not confirm delivery');
      }
      return;
    }

    const { error } = await this.sb.rpc('admin_advance_order_to', {
      p_order_id: orderId,
      p_to_status: 'DELIVERED',
      p_note: `Delivery confirmed · ${sourceLabel}`,
    });
    if (error) {
      const msg = error.message || '';
      if (msg.includes('PAID') || msg.includes('payment')) {
        throw new Error(
          'Payment must be received before marking Delivered. Use Payment Received first.',
        );
      }
      throwRpcError(error, 'Could not confirm delivery');
    }
  }

  /** Cancel order via trusted admin_cancel_order (releases reservations). */
  async cancelOrder(
    orderId: string,
    note?: string | null,
  ): Promise<{
    orderId: string;
    status: string;
    alreadyCancelled: boolean;
    reservationsReleased: number;
    stopsFailed: number;
  }> {
    const { data, error } = await this.sb.rpc('admin_cancel_order', {
      p_order_id: orderId,
      p_note: note ?? 'Order cancelled by admin',
    });
    if (error) throwRpcError(error, 'Could not cancel order');
    const row = (data ?? {}) as Record<string, unknown>;
    return {
      orderId: str(row['orderId'] ?? orderId),
      status: str(row['status'] ?? 'CANCELLED'),
      alreadyCancelled: Boolean(row['alreadyCancelled']),
      reservationsReleased: num(row['reservationsReleased']),
      stopsFailed: num(row['stopsFailed']),
    };
  }

  /**
   * Full-order return/refund for a delivered/converted sale.
   * Marks payment REFUNDED; optional inventory RETURN restock. No partial/RMA.
   */
  async refundConvertedSale(
    orderId: string,
    reason: string,
    restock = false,
  ): Promise<{
    orderId: string;
    paymentId: string;
    saleId: string | null;
    status: string;
    alreadyRefunded: boolean;
    restockedItemCount: number;
    amount: number;
  }> {
    const { data, error } = await this.sb.rpc('admin_refund_converted_sale', {
      p_order_id: orderId,
      p_reason: reason,
      p_restock: restock,
    });
    if (error) throwRpcError(error, 'Could not record return/refund');
    const row = (data ?? {}) as Record<string, unknown>;
    return {
      orderId: str(row['orderId'] ?? orderId),
      paymentId: str(row['paymentId']),
      saleId: row['saleId'] ? str(row['saleId']) : null,
      status: str(row['status'] ?? 'REFUNDED'),
      alreadyRefunded: Boolean(row['alreadyRefunded']),
      restockedItemCount: num(row['restockedItemCount']),
      amount: num(row['amount']),
    };
  }

  /** Mark out for delivery via trusted RPC. */
  async markOrderOutForDelivery(orderId: string): Promise<void> {
    const { error } = await this.sb.rpc('admin_advance_order_to', {
      p_order_id: orderId,
      p_to_status: 'OUT_FOR_DELIVERY',
      p_note: 'Out for delivery · route started',
    });
    if (error) throw error;
  }

  /** Mark payment received via trusted RPC (required before Delivered). */
  async markOrderPaymentReceived(
    orderId: string,
    collectionMethod:
      | 'CASH_ON_DELIVERY'
      | 'UPI_ON_DELIVERY'
      | 'CARD_ON_DELIVERY'
      | 'ONLINE_GATEWAY'
      | 'OTHER' = 'CASH_ON_DELIVERY',
  ): Promise<void> {
    const { error } = await this.sb.rpc('admin_mark_payment_received', {
      p_order_id: orderId,
      p_collection_method: collectionMethod,
      p_note: 'Payment received',
    });
    if (error) throwRpcError(error, 'Could not mark payment received');
  }

  /** Verify driver-reported bank/UPI payment → PAID. */
  async verifyReportedPayment(
    orderId: string,
    note?: string | null,
  ): Promise<Record<string, unknown>> {
    const { data, error } = await this.sb.rpc('admin_verify_reported_payment', {
      p_order_id: orderId,
      p_note: note ?? null,
    });
    if (error) throwRpcError(error, 'Could not verify reported payment');
    return (data ?? {}) as Record<string, unknown>;
  }

  /** Reject driver-reported bank/UPI payment → UNPAID. */
  async rejectReportedPayment(
    orderId: string,
    note?: string | null,
  ): Promise<Record<string, unknown>> {
    const { data, error } = await this.sb.rpc('admin_reject_reported_payment', {
      p_order_id: orderId,
      p_note: note ?? null,
    });
    if (error) throwRpcError(error, 'Could not reject reported payment');
    return (data ?? {}) as Record<string, unknown>;
  }

  // ─── Salesmen ───────────────────────────────────────────────────────

  async salesmenSnapshot(): Promise<SalesmenSnapshot> {
    const { data: salesmen } = await this.sb
      .from('profiles')
      .select('*')
      .contains('roles', ['SALESMAN']);

    if (!salesmen?.length) {
      const workDate = kolkataWorkDate();
      return {
        generatedAtLabel: formatDateTime(new Date().toISOString()),
        kpis: [],
        rows: [],
        fieldToday: {
          workDate,
          startedCount: 0,
          notStartedCount: 0,
          absentCount: 0,
          onLeaveCount: 0,
          pendingExpenseClaims: 0,
          pendingReturnClaims: 0,
        },
        visitCoverage: {
          rangeLabel: 'Today',
          planned: 0,
          completed: 0,
          missed: 0,
          total: 0,
        },
      };
    }

    const salesmanIds = (salesmen as unknown as Row[]).map((s) => str(s['id']));

    const { data: shops } = await this.sb
      .from('shops')
      .select('id, assigned_salesman_profile_id, service_area_id')
      .in('assigned_salesman_profile_id', salesmanIds)
      .is('deleted_at', null);

    const { data: areas } = await this.sb.from('service_areas').select('id, name');
    const areaMap = new Map((areas ?? []).map((a) => [str((a as unknown as Row)['id']), str((a as unknown as Row)['name'])]));

    const customerCountMap = new Map<string, number>();
    const territoryMap = new Map<string, string>();
    for (const sh of (shops ?? []) as Row[]) {
      const salId = str(sh['assigned_salesman_profile_id']);
      customerCountMap.set(salId, (customerCountMap.get(salId) ?? 0) + 1);
      if (!territoryMap.has(salId)) {
        territoryMap.set(salId, areaMap.get(str(sh['service_area_id'])) ?? '—');
      }
    }

    const { data: orders } = await this.sb
      .from('orders')
      .select('id, created_by_profile_id, created_at, total')
      .in('created_by_profile_id', salesmanIds);

    const orderRows = (orders ?? []) as Row[];
    const ordersCountMap = countOrdersThisMonthBySalesman(
      orderRows.map((o) => ({
        created_by_profile_id: str(o['created_by_profile_id']),
        created_at: str(o['created_at']),
      })),
    );
    const collectionsMap = new Map<string, number>();
    for (const o of orderRows) {
      const salId = str(o['created_by_profile_id']);
      collectionsMap.set(salId, (collectionsMap.get(salId) ?? 0) + num(o['total']));
    }

    const rows: SalesmanListRow[] = (salesmen as unknown as Row[]).map((s) => {
      const sid = str(s['id']);
      return {
        id: sid,
        name: str(s['display_name']),
        territory: territoryMap.get(sid) ?? '—',
        assignedCustomers: customerCountMap.get(sid) ?? 0,
        ordersThisMonth: ordersCountMap.get(sid) ?? 0,
        collectionsLabel: formatInr(collectionsMap.get(sid) ?? 0),
        status: salesmanStatusFromProfile(s),
        updatedAtLabel: formatDateTime(str(s['updated_at'])),
      };
    });

    const totalSalesmen = rows.length;
    const activeSalesmen = rows.filter((r) => r.status === 'active').length;
    const totalOrders = [...ordersCountMap.values()].reduce((a, b) => a + b, 0);
    const activeIds = rows
      .filter((r) => r.status === 'active')
      .map((r) => r.id);
    const workDate = kolkataWorkDate();

    const [
      { data: todayAttendance },
      { data: todayVisits },
      { count: pendingExpenseCount },
      { count: pendingReturnCount },
    ] = await Promise.all([
      activeIds.length
        ? this.sb
            .from('salesman_attendance')
            .select('profile_id, status, day_started_at')
            .eq('work_date', workDate)
            .in('profile_id', activeIds)
        : Promise.resolve({ data: [] as Row[] }),
      this.sb
        .from('sales_visits')
        .select('status, planned_at')
        .gte('planned_at', `${workDate}T00:00:00+05:30`)
        .lt('planned_at', `${workDate}T23:59:59.999+05:30`),
      this.sb
        .from('salesman_expenses')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING'),
      this.sb
        .from('salesman_return_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING'),
    ]);

    const fieldToday = summarizeFieldToday({
      workDate,
      activeSalesmanIds: activeIds,
      attendance: ((todayAttendance ?? []) as Row[]).map((row) => ({
        profileId: str(row['profile_id']),
        status: str(row['status']),
        dayStartedAt: row['day_started_at']
          ? str(row['day_started_at'])
          : null,
      })),
      pendingExpenseClaims: pendingExpenseCount ?? 0,
      pendingReturnClaims: pendingReturnCount ?? 0,
    });

    const visitCoverage = summarizeVisitCoverage({
      rangeLabel: 'Today',
      visits: ((todayVisits ?? []) as Row[]).map((row) => ({
        status: str(row['status']),
      })),
    });

    const pendingClaims =
      fieldToday.pendingExpenseClaims + fieldToday.pendingReturnClaims;

    return {
      generatedAtLabel: formatDateTime(new Date().toISOString()),
      kpis: [
        { id: 'total', label: 'Total Salesmen', value: `${totalSalesmen}` },
        {
          id: 'active',
          label: 'Active',
          value: `${activeSalesmen}`,
          tone: 'positive',
        },
        {
          id: 'started_today',
          label: 'Started today',
          value: `${fieldToday.startedCount}`,
          hint: workDate,
          tone: fieldToday.startedCount > 0 ? 'positive' : 'default',
        },
        {
          id: 'not_started',
          label: 'Not started',
          value: `${fieldToday.notStartedCount}`,
          hint: 'Active without day start',
          tone: fieldToday.notStartedCount > 0 ? 'warning' : 'default',
        },
        {
          id: 'visits_today',
          label: 'Visits today',
          value: `${visitCoverage.completed}/${visitCoverage.total || 0}`,
          hint: `${visitCoverage.missed} missed · ${visitCoverage.planned} open`,
        },
        {
          id: 'pending_claims',
          label: 'Pending claims',
          value: `${pendingClaims}`,
          hint: 'Expenses + returns',
          tone: pendingClaims > 0 ? 'warning' : 'default',
        },
        {
          id: 'orders',
          label: 'Orders This Month',
          value: `${totalOrders}`,
          hint: 'Calendar month · created_by salesman',
        },
      ],
      rows,
      fieldToday,
      visitCoverage,
    };
  }

  async salesmanDetail(id: string): Promise<SalesmanDetail | null> {
    const { data: profile } = await this.sb
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    if (!profile) return null;
    const s = profile as unknown as Row;

    const { data: shops } = await this.sb
      .from('shops')
      .select('*')
      .eq('assigned_salesman_profile_id', id)
      .is('deleted_at', null);

    const { data: areas } = await this.sb.from('service_areas').select('id, name');
    const areaMap = new Map((areas ?? []).map((a) => [str((a as unknown as Row)['id']), str((a as unknown as Row)['name'])]));

    const territory = (shops ?? []).length
      ? areaMap.get(str((shops![0] as unknown as Row)['service_area_id'])) ?? '—'
      : '—';

    const { data: ordersData } = await this.sb
      .from('orders')
      .select('*')
      .eq('created_by_profile_id', id)
      .order('created_at', { ascending: false })
      .limit(30);

    const { data: monthOrdersData, error: monthOrdersErr } = await this.sb
      .from('orders')
      .select('id, created_at, total')
      .eq('created_by_profile_id', id);
    if (monthOrdersErr) {
      throwRpcError(monthOrdersErr, 'Could not load salesman orders for month KPI');
    }
    const monthOrderRows = ((monthOrdersData ?? []) as Row[]).map((o) => ({
      created_at: str(o['created_at']),
      total: num(o['total']),
    }));
    const ordersThisMonth = countOrdersInCalendarMonth(monthOrderRows);
    const revenueThisMonth = sumOrderRevenueInCalendarMonth(monthOrderRows);

    const { data: visitsData, error: visitsErr } = await this.sb
      .from('sales_visits')
      .select('id, shop_id, planned_at, visited_at, status, notes')
      .eq('salesman_profile_id', id)
      .order('planned_at', { ascending: false })
      .limit(50);
    if (visitsErr) {
      throwRpcError(visitsErr, 'Could not load salesman visits');
    }

    const shopIds = ((shops ?? []) as unknown as Row[]).map((sh) => str(sh['id']));
    const { data: shopOrdersData } = shopIds.length
      ? await this.sb
          .from('orders')
          .select('shop_id, created_at')
          .in('shop_id', shopIds)
          .order('created_at', { ascending: false })
          .limit(500)
      : { data: [] as Row[] };

    const lastOrderByShop = latestOrderAtByShop(
      ((shopOrdersData ?? []) as Row[]).map((o) => ({
        shop_id: str(o['shop_id']),
        created_at: str(o['created_at']),
      })),
    );
    const lastVisitByShop = latestVisitAtByShop(
      ((visitsData ?? []) as Row[]).map((v) => ({
        shop_id: str(v['shop_id']),
        planned_at: str(v['planned_at']),
        visited_at: v['visited_at'] ? str(v['visited_at']) : null,
      })),
    );

    const shopNameMap = new Map((shops ?? []).map((sh) => [str((sh as unknown as Row)['id']), str((sh as unknown as Row)['trade_name'])]));
    const shopAreaMap = new Map<string, string>();

    // Resolve shop names for visits that may not be in assigned shops list.
    const visitShopIds = [
      ...new Set(
        ((visitsData ?? []) as Row[])
          .map((v) => str(v['shop_id']))
          .filter((sid) => sid && !shopNameMap.has(sid)),
      ),
    ];
    if (visitShopIds.length > 0) {
      const { data: visitShops } = await this.sb
        .from('shops')
        .select('id, trade_name, service_area_id')
        .in('id', visitShopIds);
      for (const sh of (visitShops ?? []) as Row[]) {
        shopNameMap.set(str(sh['id']), str(sh['trade_name']));
        const areaId = str(sh['service_area_id']);
        if (areaId) {
          shopAreaMap.set(str(sh['id']), areaMap.get(areaId) ?? '—');
        }
      }
    }

    // Area labels for assigned shops
    for (const sh of (shops ?? []) as unknown as Row[]) {
      shopAreaMap.set(
        str(sh['id']),
        areaMap.get(str(sh['service_area_id'])) ?? '—',
      );
    }

    const visits: SalesmanVisitRow[] = ((visitsData ?? []) as Row[]).map((v) => {
      const shopId = str(v['shop_id']);
      return {
        id: str(v['id']),
        shopName: shopNameMap.get(shopId) ?? '—',
        areaLabel: shopAreaMap.get(shopId) ?? territory,
        plannedAtLabel: formatDateTime(str(v['planned_at'])),
        status: mapSalesVisitStatus(str(v['status'])),
        note: str(v['notes']) || undefined,
      };
    });

    const assignedCustomers: SalesmanAssignedCustomer[] = ((shops ?? []) as unknown as Row[]).map((sh) => {
      const lifecycle = str(sh['lifecycle_status']);
      const activation = lifecycleToActivation(lifecycle);
      const shopId = str(sh['id']);
      const lastOrderIso = lastOrderByShop.get(shopId);
      const lastVisitIso = lastVisitByShop.get(shopId);
      return {
        id: shopId,
        shopName: str(sh['trade_name']),
        areaLabel: areaMap.get(str(sh['service_area_id'])) ?? '—',
        accountStatusLabel: lifecycle.replace(/_/g, ' ').toLowerCase(),
        lastOrderLabel: lastOrderIso ? formatDate(lastOrderIso) : '—',
        lastVisitLabel: lastVisitIso ? formatDate(lastVisitIso) : '—',
        activationStatus: activation,
        activationLabel: activation.replace(/_/g, ' '),
      };
    });

    const salesmanOrders: SalesmanOrderRow[] = ((ordersData ?? []) as Row[]).map((o) => ({
      id: str(o['id']),
      orderCode: shortCode(str(o['id']), 'GA'),
      customerName: shopNameMap.get(str(o['shop_id'])) ?? '—',
      amountLabel: formatInr(num(o['total'])),
      statusLabel: str(o['status']).replace(/_/g, ' '),
      dateLabel: formatDate(str(o['created_at'])),
    }));

    const orderIds = ((ordersData ?? []) as Row[]).map((o) => str(o['id']));
    const { data: payments } = orderIds.length
      ? await this.sb.from('payments').select('*').in('order_id', orderIds)
      : { data: [] as Row[] };

    const paidPayments = ((payments ?? []) as Row[]).filter((p) => str(p['status']) === 'PAID' || str(p['status']) === 'CAPTURED');
    const codCollected = paidPayments
      .filter((p) => str(p['method']) === 'COD' || str(p['method']) === 'CASH')
      .reduce((sum, p) => sum + num(p['amount']), 0);
    const onlineCollected = paidPayments
      .filter((p) => str(p['method']) !== 'COD' && str(p['method']) !== 'CASH')
      .reduce((sum, p) => sum + num(p['amount']), 0);

    const pendingPayments = ((payments ?? []) as Row[]).filter((p) =>
      str(p['status']) !== 'PAID' && str(p['status']) !== 'CAPTURED',
    );
    const pendingAmount = pendingPayments.reduce((sum, p) => sum + num(p['amount']), 0);

    const collectionHistory: SalesmanCollectionRow[] = paidPayments.map((p) => ({
      id: str(p['id']),
      orderCode: shortCode(str(p['order_id']), 'GA'),
      customerName: shopNameMap.get(str((ordersData ?? []).find((o) => str((o as unknown as Row)['id']) === str(p['order_id']))?.['shop_id' as never] ?? '')) ?? '—',
      methodLabel: str(p['method']) || 'COD',
      amountLabel: formatInr(num(p['amount'])),
      statusLabel: 'Collected',
      atLabel: formatDateTime(str(p['created_at'])),
    }));

    const totalOrders = (ordersData ?? []).length;

    const [
      { data: employmentRow },
      { data: salaryRows },
      { data: attendanceRows },
      { data: holidayRows },
    ] = await Promise.all([
      this.sb
        .from('salesman_employment')
        .select('*')
        .eq('profile_id', id)
        .maybeSingle(),
      this.sb
        .from('salesman_salary_terms')
        .select('*')
        .eq('profile_id', id)
        .order('effective_from', { ascending: false }),
      this.sb
        .from('salesman_attendance')
        .select('*')
        .eq('profile_id', id)
        .order('work_date', { ascending: false })
        .limit(62),
      this.sb
        .from('company_holidays')
        .select('holiday_date, name, service_area_id'),
    ]);

    const emp = employmentRow as unknown as Row | null;
    let employment: SalesmanEmploymentVm | null = null;
    if (emp) {
      const weeklyOff = num(emp['weekly_off_dow']) as Dow;
      const workingDays = Array.isArray(emp['working_days'])
        ? (emp['working_days'] as number[])
        : [1, 2, 3, 4, 5, 6];
      const areaId = emp['primary_service_area_id']
        ? str(emp['primary_service_area_id'])
        : null;
      employment = {
        joiningDate: str(emp['joining_date']).slice(0, 10),
        joiningDateLabel: formatDate(str(emp['joining_date'])),
        employmentStatus: str(emp['employment_status']) as
          | 'ACTIVE'
          | 'INACTIVE'
          | 'SUSPENDED',
        earningModel: (str(emp['earning_model']) ||
          'SALARY') as SalesmanEmploymentVm['earningModel'],
        address: emp['address'] != null ? str(emp['address']) : null,
        contactEmail:
          emp['contact_email'] != null ? str(emp['contact_email']) : null,
        idProofType: emp['id_proof_type']
          ? (str(emp['id_proof_type']) as 'AADHAAR' | 'PAN' | 'OTHER')
          : null,
        idProofNumber:
          emp['id_proof_number'] != null ? str(emp['id_proof_number']) : null,
        primaryServiceAreaId: areaId,
        primaryServiceAreaLabel: areaId ? (areaMap.get(areaId) ?? '—') : '—',
        weeklyOffDow: weeklyOff,
        weeklyOffLabel: DOW_LABELS[weeklyOff] ?? String(weeklyOff),
        workingDays,
        workingDaysLabel: workingDays
          .map((d) => DOW_LABELS[d as Dow] ?? String(d))
          .join(', '),
      };
    }

    const mapSalary = (r: Row): SalesmanSalaryTermsVm => ({
      id: str(r['id']),
      monthlySalary: num(r['monthly_salary']),
      monthlySalaryLabel: formatInr(num(r['monthly_salary'])),
      dailyAllowance: num(r['daily_allowance']),
      dailyAllowanceLabel: formatInr(num(r['daily_allowance'])),
      otherAllowance: num(r['other_allowance']),
      otherAllowanceLabel: formatInr(num(r['other_allowance'])),
      effectiveFrom: str(r['effective_from']).slice(0, 10),
      effectiveFromLabel: formatDate(str(r['effective_from'])),
      effectiveTo: r['effective_to']
        ? str(r['effective_to']).slice(0, 10)
        : null,
      effectiveToLabel: r['effective_to']
        ? formatDate(str(r['effective_to']))
        : 'Current',
    });

    const salaryHistory = ((salaryRows ?? []) as Row[]).map(mapSalary);
    const currentSalary =
      salaryHistory.find((t) => t.effectiveTo == null) ??
      salaryHistory[0] ??
      null;

    const attendance = ((attendanceRows ?? []) as Row[]).map((r) => ({
      id: str(r['id']),
      workDate: str(r['work_date']).slice(0, 10),
      workDateLabel: formatDate(str(r['work_date'])),
      status: str(r['status']) as SalesmanAttendanceStatusVm,
      dayStartedAtLabel: r['day_started_at']
        ? formatDateTime(str(r['day_started_at']))
        : null,
      dayEndedAtLabel: r['day_ended_at']
        ? formatDateTime(str(r['day_ended_at']))
        : null,
      correctionReason: r['correction_reason']
        ? str(r['correction_reason'])
        : null,
    }));

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
    const monthAttendance = attendance.filter((a) =>
      a.workDate.startsWith(monthPrefix),
    );
    const counts = summarizeAttendanceStatuses(
      monthAttendance.map((a) => ({
        status: a.status as AttendanceStatusCode,
      })),
    );

    const holidayDates = ((holidayRows ?? []) as Row[])
      .filter((h) => {
        const area = h['service_area_id'] ? str(h['service_area_id']) : null;
        if (!area) return true;
        return employment?.primaryServiceAreaId === area;
      })
      .map((h) => str(h['holiday_date']).slice(0, 10));

    let salaryMonth: SalesmanDetail['salaryMonth'] = null;
    if (!employment || !currentSalary) {
      salaryMonth = {
        year,
        month,
        monthLabel: now.toLocaleString('en-IN', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }),
        monthlySalaryLabel: '—',
        dailyAllowanceLabel: '—',
        otherAllowanceLabel: '—',
        scheduledWorkingDays: 0,
        presentDays: counts.presentDays,
        paidLeaveDays: counts.paidLeaveDays,
        unpaidLeaveDays: counts.unpaidLeaveDays,
        weeklyOffDays: counts.weeklyOffDays,
        holidayDays: counts.holidayDays,
        absentDays: counts.absentDays,
        dailyRateLabel: '—',
        unpaidDeductionLabel: '—',
        finalPayableLabel: '—',
        formulaLabel: '',
        unavailableReason: !employment
          ? 'Employment / working days not configured yet.'
          : 'Salary terms not set yet.',
      };
    } else {
      const scheduled = countScheduledWorkingDays({
        year,
        month,
        workingDays: employment.workingDays,
        weeklyOffDow: employment.weeklyOffDow,
        holidayDates,
      });
      const summary = calculateMonthlySalarySummary({
        monthlySalary: currentSalary.monthlySalary,
        dailyAllowance: currentSalary.dailyAllowance,
        otherAllowance: currentSalary.otherAllowance,
        scheduledWorkingDays: scheduled,
        ...counts,
      });
      salaryMonth = {
        year,
        month,
        monthLabel: now.toLocaleString('en-IN', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }),
        monthlySalaryLabel: formatInr(summary.monthlySalary),
        dailyAllowanceLabel: formatInr(summary.dailyAllowance),
        otherAllowanceLabel: formatInr(summary.otherAllowance),
        scheduledWorkingDays: summary.scheduledWorkingDays,
        presentDays: summary.presentDays,
        paidLeaveDays: summary.paidLeaveDays,
        unpaidLeaveDays: summary.unpaidLeaveDays,
        weeklyOffDays: summary.weeklyOffDays,
        holidayDays: summary.holidayDays,
        absentDays: summary.absentDays,
        dailyRateLabel: formatInr(summary.dailyRate),
        unpaidDeductionLabel: formatInr(summary.unpaidDeduction),
        finalPayableLabel: formatInr(summary.finalPayable),
        formulaLabel: summary.formulaLabel,
      };
    }

    const monthVisits = ((visitsData ?? []) as Row[]).filter((v) =>
      str(v['planned_at']).startsWith(monthPrefix),
    );
    const visitsCompletedThisMonth = monthVisits.filter(
      (v) => str(v['status']) === 'VISITED',
    ).length;
    const visitsMissedThisMonth = monthVisits.filter(
      (v) => str(v['status']) === 'MISSED',
    ).length;
    const customersVisitedThisMonth = new Set(
      monthVisits
        .filter((v) => str(v['status']) === 'VISITED')
        .map((v) => str(v['shop_id'])),
    ).size;

    const territoryLabel =
      employment?.primaryServiceAreaLabel &&
      employment.primaryServiceAreaLabel !== '—'
        ? employment.primaryServiceAreaLabel
        : territory;

    return {
      id: str(s['id']),
      name: str(s['display_name']),
      phoneLabel: str(s['mobile']) || '—',
      emailLabel: employment?.contactEmail ?? '—',
      employeeId: shortCode(str(s['id']), 'EMP'),
      territory: territoryLabel,
      joiningDateLabel:
        employment?.joiningDateLabel ?? formatDate(str(s['created_at'])),
      status: salesmanStatusFromProfile(
        s,
        employment?.employmentStatus ?? null,
      ),
      assignedCustomersCount: assignedCustomers.length,
      totalOrders,
      updatedAtLabel: formatDateTime(str(s['updated_at'])),
      assignedCustomers,
      orders: salesmanOrders,
      collections: {
        codCollectedLabel: formatInr(codCollected),
        onlinePaymentsLabel: formatInr(onlineCollected),
        pendingCollectionsLabel: formatInr(pendingAmount),
      },
      collectionHistory,
      performance: {
        ordersThisMonth,
        revenueGeneratedLabel: formatInr(revenueThisMonth),
        newCustomers: assignedCustomers.filter(
          (c) => c.activationStatus === 'created',
        ).length,
        repeatCustomers: assignedCustomers.filter(
          (c) => c.activationStatus === 'activated',
        ).length,
        activationSuccessRateLabel: assignedCustomers.length
          ? `${Math.round(
              (assignedCustomers.filter((c) => c.activationStatus === 'activated')
                .length /
                assignedCustomers.length) *
                100,
            )}%`
          : '0%',
        averageOrderValueLabel:
          ordersThisMonth > 0
            ? formatInr(revenueThisMonth / ordersThisMonth)
            : '—',
        visitsCompletedThisMonth,
        visitsMissedThisMonth,
        customersVisitedThisMonth,
        collectionsLabel: formatInr(codCollected + onlineCollected),
      },
      visits,
      visitsSource: 'sales_visits',
      employment,
      currentSalary,
      salaryHistory,
      attendance,
      salaryMonth,
    };
  }

  /**
   * Salesman H2: atomically reassign shop salesman via trusted RPC.
   * Closes active shop_salesman_assignments and opens a new history row.
   */
  async reassignShopSalesman(
    shopId: string,
    newSalesmanProfileId: string,
    reason?: string | null,
  ): Promise<{
    shopId: string;
    salesmanProfileId: string;
    assignmentId: string;
    alreadyAssigned: boolean;
    closedAssignmentCount: number;
  }> {
    const { data, error } = await this.sb.rpc('admin_reassign_shop_salesman', {
      p_shop_id: shopId,
      p_new_salesman_profile_id: newSalesmanProfileId,
      p_reason: reason ?? 'Reassigned by Admin',
    });
    if (error) throwRpcError(error, 'Could not reassign salesman');
    const row = (data ?? {}) as Record<string, unknown>;
    return {
      shopId: str(row['shopId'] ?? shopId),
      salesmanProfileId: str(row['salesmanProfileId'] ?? newSalesmanProfileId),
      assignmentId: str(row['assignmentId']),
      alreadyAssigned: Boolean(row['alreadyAssigned']),
      closedAssignmentCount: num(row['closedAssignmentCount']),
    };
  }

  /**
   * Salesman H2: create a PLANNED sales_visits row for an assigned shop.
   */
  async createSalesVisit(input: {
    salesmanProfileId: string;
    shopId: string;
    plannedAt?: string | null;
    notes?: string | null;
  }): Promise<{
    visitId: string;
    salesmanProfileId: string;
    shopId: string;
    plannedAt: string;
    status: string;
  }> {
    const { data, error } = await this.sb.rpc('admin_create_sales_visit', {
      p_salesman_profile_id: input.salesmanProfileId,
      p_shop_id: input.shopId,
      p_planned_at: input.plannedAt ?? null,
      p_notes: input.notes ?? null,
    });
    if (error) throwRpcError(error, 'Could not create sales visit');
    const row = (data ?? {}) as Record<string, unknown>;
    return {
      visitId: str(row['visitId']),
      salesmanProfileId: str(row['salesmanProfileId'] ?? input.salesmanProfileId),
      shopId: str(row['shopId'] ?? input.shopId),
      plannedAt: str(row['plannedAt']),
      status: str(row['status'] ?? 'PLANNED'),
    };
  }

  /**
   * Salesman H3: create Auth user + SALESMAN profile via edge function.
   * Service role stays on the server; browser sends caller JWT only.
   */
  async provisionSalesman(input: {
    displayName: string;
    mobile: string;
    email: string;
    temporaryPassword: string;
    isActive?: boolean;
  }): Promise<{
    profileId: string;
    authUserId: string;
    email: string;
    displayName: string;
    mobile: string;
    alreadyProvisioned: boolean;
    createdAuthUser: boolean;
    temporaryPasswordSet?: boolean;
    invitationEmailSent?: boolean;
    invitationEmailError?: string | null;
  }> {
    const { data, error } = await this.sb.functions.invoke('provision-salesman', {
      body: {
        displayName: input.displayName,
        mobile: input.mobile,
        email: input.email,
        temporaryPassword: input.temporaryPassword,
        isActive: input.isActive ?? true,
      },
    });
    if (error) {
      const ctx = error as { context?: Response; message?: string };
      let detail = ctx.message ?? 'Could not provision salesman';
      try {
        if (ctx.context) {
          const payload = (await ctx.context.json()) as { error?: string; code?: string };
          if (payload.error) detail = payload.error;
        }
      } catch {
        /* keep detail */
      }
      throw new Error(detail);
    }
    const row = (data ?? {}) as Record<string, unknown>;
    if (row['error']) {
      throw new Error(str(row['error']));
    }
    return {
      profileId: str(row['profileId']),
      authUserId: str(row['authUserId'] ?? row['profileId']),
      email: str(row['email'] ?? input.email),
      displayName: str(row['displayName'] ?? input.displayName),
      mobile: str(row['mobile'] ?? input.mobile),
      alreadyProvisioned: Boolean(row['alreadyProvisioned']),
      createdAuthUser: Boolean(row['createdAuthUser']),
      temporaryPasswordSet:
        row['temporaryPasswordSet'] === undefined
          ? undefined
          : Boolean(row['temporaryPasswordSet']),
      invitationEmailSent: row['invitationEmailSent'] === true,
      invitationEmailError:
        typeof row['invitationEmailError'] === 'string' ? row['invitationEmailError'] : null,
    };
  }

  /** Salesman H4: upsert employment / weekly off / working days. */
  async upsertSalesmanEmployment(input: {
    profileId: string;
    joiningDate?: string;
    employmentStatus?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    address?: string;
    contactEmail?: string;
    idProofType?: 'AADHAAR' | 'PAN' | 'OTHER' | null;
    idProofNumber?: string;
    primaryServiceAreaId?: string | null;
    weeklyOffDow: number;
    workingDays: number[];
  }): Promise<Record<string, unknown>> {
    const { data, error } = await this.sb.rpc(
      'admin_upsert_salesman_employment',
      {
        p_profile_id: input.profileId,
        p_joining_date: input.joiningDate ?? null,
        p_employment_status: input.employmentStatus ?? 'ACTIVE',
        p_address: input.address ?? null,
        p_contact_email: input.contactEmail || null,
        p_id_proof_type: input.idProofType ?? null,
        p_id_proof_number: input.idProofNumber ?? null,
        p_primary_service_area_id: input.primaryServiceAreaId ?? null,
        p_weekly_off_dow: input.weeklyOffDow,
        p_working_days: input.workingDays,
      },
    );
    if (error) throwRpcError(error, 'Could not save salesman employment');
    return (data ?? {}) as Record<string, unknown>;
  }

  /** Salesman H4: append-only salary terms. */
  async setSalesmanSalaryTerms(input: {
    profileId: string;
    monthlySalary: number;
    dailyAllowance?: number;
    otherAllowance?: number;
    effectiveFrom?: string;
  }): Promise<Record<string, unknown>> {
    const { data, error } = await this.sb.rpc(
      'admin_set_salesman_salary_terms',
      {
        p_profile_id: input.profileId,
        p_monthly_salary: input.monthlySalary,
        p_daily_allowance: input.dailyAllowance ?? 0,
        p_other_allowance: input.otherAllowance ?? 0,
        p_effective_from: input.effectiveFrom ?? null,
      },
    );
    if (error) throwRpcError(error, 'Could not set salary terms');
    return (data ?? {}) as Record<string, unknown>;
  }

  /** Admin: read one salesman month target. Null when none is set. */
  async getSalesmanTarget(
    profileId: string,
    month: string,
  ): Promise<SalesmanTargetProgress | null> {
    const { data, error } = await this.sb.rpc('admin_get_salesman_target', {
      p_profile_id: profileId,
      p_month: month,
    });
    if (error) throwRpcError(error, 'Could not load the target');
    return parseSalesmanTarget(data);
  }

  /** Admin: create or replace one salesman month target. */
  async setSalesmanTarget(input: {
    profileId: string;
    month: string;
    targetAmount: number;
  }): Promise<SalesmanTargetProgress> {
    const { data, error } = await this.sb.rpc('admin_set_salesman_target', {
      p_profile_id: input.profileId,
      p_month: input.month,
      p_target_amount: input.targetAmount,
    });
    if (error) throwRpcError(error, 'Could not save the target');
    const parsed = parseSalesmanTarget(data);
    if (!parsed) throw new Error('Could not save the target');
    return parsed;
  }

  /** Admin: pending expense + return claims across the team. */
  async listPendingTeamClaims(): Promise<
    {
      id: string;
      kind: 'expense' | 'return';
      salesmanProfileId: string;
      salesmanName: string;
      title: string;
      detail: string;
      amountLabel: string | null;
      createdAtLabel: string;
      href: string;
    }[]
  > {
    const [{ data: expenses }, { data: returns }, { data: profiles }] =
      await Promise.all([
        this.sb
          .from('salesman_expenses')
          .select(
            'id, salesman_profile_id, category, amount, expense_date, note, created_at',
          )
          .eq('status', 'PENDING')
          .order('created_at', { ascending: false })
          .limit(100),
        this.sb
          .from('salesman_return_requests')
          .select(
            'id, salesman_profile_id, shop_name, product_name, sku_name, quantity, reason, created_at',
          )
          .eq('status', 'PENDING')
          .order('created_at', { ascending: false })
          .limit(100),
        this.sb
          .from('profiles')
          .select('id, display_name')
          .contains('roles', ['SALESMAN']),
      ]);

    const nameById = new Map(
      ((profiles ?? []) as Row[]).map(
        (p) => [str(p['id']), str(p['display_name'])] as const,
      ),
    );

    const expenseRows = ((expenses ?? []) as Row[]).map((row) => {
      const profileId = str(row['salesman_profile_id']);
      return {
        id: str(row['id']),
        kind: 'expense' as const,
        salesmanProfileId: profileId,
        salesmanName: nameById.get(profileId) ?? '—',
        title: str(row['category']).replace(/_/g, ' '),
        detail: row['note'] ? str(row['note']) : str(row['expense_date']).slice(0, 10),
        amountLabel: formatInr(num(row['amount'])),
        createdAtLabel: formatDateTime(str(row['created_at'])),
        href: `/salesmen/${profileId}?tab=claims`,
      };
    });

    const returnRows = ((returns ?? []) as Row[]).map((row) => {
      const profileId = str(row['salesman_profile_id']);
      return {
        id: str(row['id']),
        kind: 'return' as const,
        salesmanProfileId: profileId,
        salesmanName: nameById.get(profileId) ?? '—',
        title: `${str(row['product_name'])} · ${str(row['shop_name'])}`,
        detail: `Qty ${num(row['quantity'])} · ${str(row['reason'])}`,
        amountLabel: null,
        createdAtLabel: formatDateTime(str(row['created_at'])),
        href: `/salesmen/${profileId}?tab=claims`,
      };
    });

    return [...expenseRows, ...returnRows].sort((a, b) =>
      b.createdAtLabel.localeCompare(a.createdAtLabel),
    );
  }

  /** Admin: commission ledger lines for one salesman (newest first). */
  async listSalesmanCommissionEntries(
    profileId: string,
    limit = 50,
  ): Promise<
    {
      id: string;
      status: string;
      statusLabel: string;
      quantity: number;
      unitCommission: number;
      commissionAmount: number;
      commissionAmountLabel: string;
      orderId: string;
      orderHref: string;
      createdAtLabel: string;
    }[]
  > {
    const { data, error } = await this.sb
      .from('salesman_commission_entries')
      .select(
        'id, status, quantity, unit_commission, commission_amount, order_id, created_at',
      )
      .eq('salesman_profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throwRpcError(error, 'Could not load commission ledger');
    return ((data ?? []) as Row[]).map((row) => {
      const status = str(row['status']);
      return {
        id: str(row['id']),
        status,
        statusLabel: status === 'REVERSED' ? 'Reversed' : 'Earned',
        quantity: num(row['quantity']),
        unitCommission: num(row['unit_commission']),
        commissionAmount: num(row['commission_amount']),
        commissionAmountLabel: formatInr(num(row['commission_amount'])),
        orderId: str(row['order_id']),
        orderHref: `/orders/${str(row['order_id'])}`,
        createdAtLabel: formatDateTime(str(row['created_at'])),
      };
    });
  }

  async listCompanyHolidays(): Promise<
    {
      id: string;
      holidayDate: string;
      name: string;
      serviceAreaId: string | null;
      serviceAreaLabel: string;
    }[]
  > {
    const [{ data: holidays, error }, { data: areas }] = await Promise.all([
      this.sb
        .from('company_holidays')
        .select('id, holiday_date, name, service_area_id')
        .order('holiday_date', { ascending: true }),
      this.sb.from('service_areas').select('id, name'),
    ]);
    if (error) throwRpcError(error, 'Could not load company holidays');
    const areaMap = new Map(
      ((areas ?? []) as Row[]).map(
        (a) => [str(a['id']), str(a['name'])] as const,
      ),
    );
    return ((holidays ?? []) as Row[]).map((row) => {
      const areaId = row['service_area_id']
        ? str(row['service_area_id'])
        : null;
      return {
        id: str(row['id']),
        holidayDate: str(row['holiday_date']).slice(0, 10),
        name: str(row['name']),
        serviceAreaId: areaId,
        serviceAreaLabel: areaId
          ? (areaMap.get(areaId) ?? '—')
          : 'Company-wide',
      };
    });
  }

  /** Admin: one salesman's expense claims. Approval does not create a payment. */
  async listSalesmanExpenses(profileId: string): Promise<SalesmanExpense[]> {
    const { data, error } = await this.sb
      .from('salesman_expenses')
      .select(
        'id, salesman_profile_id, category, amount, expense_date, note, receipt_path, status, review_note, reviewed_at, created_at',
      )
      .eq('salesman_profile_id', profileId)
      .order('created_at', { ascending: false });
    if (error) throwRpcError(error, 'Could not load expenses');
    return Promise.all((data ?? []).map((row) => mapAdminExpense(this.sb, row)));
  }

  async reviewSalesmanExpense(input: {
    expenseId: string;
    status: 'APPROVED' | 'REJECTED';
    reviewNote?: string | null;
  }): Promise<void> {
    const { error } = await this.sb.rpc('admin_review_salesman_expense', {
      p_expense_id: input.expenseId,
      p_status: input.status,
      p_review_note: input.reviewNote ?? null,
    });
    if (error) throwRpcError(error, 'Could not review the expense');
  }

  /** Admin: one salesman's return/damage requests. Approval does not change stock. */
  async listSalesmanReturnRequests(profileId: string): Promise<SalesmanReturnRequest[]> {
    const { data, error } = await this.sb
      .from('salesman_return_requests')
      .select(
        'id, salesman_profile_id, shop_id, shop_name, order_id, sku_id, product_name, sku_name, sku_code, quantity, reason, note, photo_path, status, review_note, reviewed_at, created_at',
      )
      .eq('salesman_profile_id', profileId)
      .order('created_at', { ascending: false });
    if (error) throwRpcError(error, 'Could not load return requests');
    return Promise.all((data ?? []).map((row) => mapAdminReturn(this.sb, row)));
  }

  async reviewReturnRequest(input: {
    requestId: string;
    status: 'APPROVED' | 'REJECTED';
    reviewNote?: string | null;
  }): Promise<void> {
    const { error } = await this.sb.rpc('admin_review_return_request', {
      p_request_id: input.requestId,
      p_status: input.status,
      p_review_note: input.reviewNote ?? null,
    });
    if (error) throwRpcError(error, 'Could not review the return request');
  }

  async listSalesmanMessages(profileId: string): Promise<SalesmanMessage[]> {
    const { data, error } = await this.sb
      .from('salesman_messages')
      .select('id, salesman_profile_id, sender_profile_id, body, created_at')
      .eq('salesman_profile_id', profileId)
      .order('created_at', { ascending: true });
    if (error) throwRpcError(error, 'Could not load messages');
    return (data ?? []).map((row) => ({
      id: row.id,
      salesmanProfileId: row.salesman_profile_id,
      senderProfileId: row.sender_profile_id,
      body: row.body,
      createdAt: row.created_at,
    }));
  }

  async sendSalesmanMessage(profileId: string, body: string): Promise<void> {
    const { error } = await this.sb.rpc('admin_send_salesman_message', {
      p_salesman_id: profileId,
      p_body: body,
    });
    if (error) throwRpcError(error, 'Could not send the message');
  }

  async listSalesmanVoiceNotes(profileId: string): Promise<SalesmanVoiceNote[]> {
    const { data, error } = await this.sb
      .from('salesman_voice_notes')
      .select('id, salesman_profile_id, shop_id, visit_id, audio_path, duration_seconds, created_at')
      .eq('salesman_profile_id', profileId)
      .order('created_at', { ascending: false });
    if (error) throwRpcError(error, 'Could not load voice notes');
    return Promise.all(
      (data ?? []).map(async (row) => {
        let audioUrl: string | null = null;
        if (row.audio_path) {
          const signed = await this.sb.storage
            .from('salesman-media')
            .createSignedUrl(row.audio_path, 60 * 60);
          audioUrl = signed.data?.signedUrl ?? null;
        }
        return {
          id: row.id,
          salesmanProfileId: row.salesman_profile_id,
          shopId: row.shop_id,
          visitId: row.visit_id,
          audioPath: row.audio_path,
          audioUrl,
          durationSeconds: Number(row.duration_seconds),
          createdAt: row.created_at,
        };
      }),
    );
  }

  /** Admin: set earning model without touching salary terms or ledger. */
  async setSalesmanEarningModel(input: {
    profileId: string;
    earningModel: 'SALARY' | 'COMMISSION' | 'SALARY_PLUS_COMMISSION';
  }): Promise<{ profileId: string; earningModel: string }> {
    const { data, error } = await this.sb.rpc(
      'admin_set_salesman_earning_model',
      {
        p_profile_id: input.profileId,
        p_earning_model: input.earningModel,
      },
    );
    if (error) throwRpcError(error, 'Could not set earning model');
    const row = (data ?? {}) as Record<string, unknown>;
    return {
      profileId: str(row['profileId'] ?? input.profileId),
      earningModel: str(row['earningModel'] ?? input.earningModel),
    };
  }

  /** Admin: close open SKU commission term and append a new one. */
  async setSkuCommissionTerm(input: {
    skuId: string;
    fixedAmountPerUnit: number;
    effectiveFrom?: string;
  }): Promise<Record<string, unknown>> {
    const { data, error } = await this.sb.rpc('admin_set_sku_commission_term', {
      p_sku_id: input.skuId,
      p_fixed_amount_per_unit: input.fixedAmountPerUnit,
      p_effective_from: input.effectiveFrom ?? null,
    });
    if (error) throwRpcError(error, 'Could not set SKU commission');
    return (data ?? {}) as Record<string, unknown>;
  }

  async listSkuCommissionRows(): Promise<SkuCommissionRowVm[]> {
    const [{ data: skus, error: skuError }, { data: products, error: productError }, { data: terms, error: termError }] =
      await Promise.all([
        this.sb
          .from('skus')
          .select('id, name, sku_code, selling_unit, product_id, is_active')
          .is('deleted_at', null)
          .order('name', { ascending: true }),
        this.sb.from('products').select('id, name').is('deleted_at', null),
        this.sb
          .from('sku_commission_terms')
          .select(
            'id, sku_id, fixed_amount_per_unit, effective_from, effective_to, created_at',
          )
          .order('effective_from', { ascending: false }),
      ]);
    if (skuError) throw skuError;
    if (productError) throw productError;
    if (termError) throw termError;

    const productName = new Map(
      ((products ?? []) as Row[]).map((p) => [str(p['id']), str(p['name'])]),
    );
    const termsBySku = new Map<string, Row[]>();
    for (const term of (terms ?? []) as Row[]) {
      const skuId = str(term['sku_id']);
      const list = termsBySku.get(skuId) ?? [];
      list.push(term);
      termsBySku.set(skuId, list);
    }

    return ((skus ?? []) as Row[])
      .filter((sku) => sku['is_active'] !== false)
      .map((sku) => {
        const skuId = str(sku['id']);
        const history = (termsBySku.get(skuId) ?? []).map((term) => ({
          amount: num(term['fixed_amount_per_unit']),
          amountLabel: formatInrPrecise(num(term['fixed_amount_per_unit'])),
          effectiveFrom: str(term['effective_from']).slice(0, 10),
          effectiveTo: term['effective_to']
            ? str(term['effective_to']).slice(0, 10)
            : null,
          open: term['effective_to'] == null,
        }));
        const current = history.find((row) => row.open) ?? null;
        return {
          skuId,
          productName: productName.get(str(sku['product_id'])) ?? '—',
          skuName: str(sku['name']),
          skuCode: str(sku['sku_code']),
          sellingUnit: str(sku['selling_unit']),
          currentAmount: current?.amount ?? null,
          currentAmountLabel: current?.amountLabel ?? '—',
          effectiveFrom: current?.effectiveFrom ?? null,
          open: Boolean(current),
          history,
        };
      });
  }

  /** Salesman H4: admin set/correct attendance (reason required on change). */
  async setSalesmanAttendance(input: {
    profileId: string;
    workDate: string;
    status: SalesmanAttendanceStatusVm;
    reason?: string;
  }): Promise<Record<string, unknown>> {
    const { data, error } = await this.sb.rpc(
      'admin_set_salesman_attendance',
      {
        p_profile_id: input.profileId,
        p_work_date: input.workDate,
        p_status: input.status,
        p_reason: input.reason ?? null,
      },
    );
    if (error) throwRpcError(error, 'Could not set attendance');
    return (data ?? {}) as Record<string, unknown>;
  }

  async upsertCompanyHoliday(input: {
    holidayDate: string;
    name: string;
    serviceAreaId?: string | null;
    holidayId?: string;
  }): Promise<Record<string, unknown>> {
    const { data, error } = await this.sb.rpc('admin_upsert_company_holiday', {
      p_holiday_date: input.holidayDate,
      p_name: input.name,
      p_service_area_id: input.serviceAreaId ?? null,
      p_holiday_id: input.holidayId ?? null,
    });
    if (error) throwRpcError(error, 'Could not save holiday');
    return (data ?? {}) as Record<string, unknown>;
  }

  /**
   * Salesman H3: admin marks a PLANNED/PENDING visit VISITED or MISSED.
   */
  async updateSalesVisitStatus(
    visitId: string,
    status: 'completed' | 'missed',
  ): Promise<{
    visitId: string;
    status: string;
    visitedAt: string | null;
    salesmanProfileId: string;
    shopId: string;
  }> {
    const { data, error } = await this.sb.rpc('admin_update_sales_visit_status', {
      p_visit_id: visitId,
      p_status: mapVisitStatusToDb(status),
    });
    if (error) throwRpcError(error, 'Could not update visit status');
    const row = (data ?? {}) as Record<string, unknown>;
    return {
      visitId: str(row['visitId'] ?? visitId),
      status: str(row['status']),
      visitedAt: row['visitedAt'] ? str(row['visitedAt']) : null,
      salesmanProfileId: str(row['salesmanProfileId']),
      shopId: str(row['shopId']),
    };
  }

  // ─── Delivery H5 ────────────────────────────────────────────────────

  async provisionDelivery(
    input: Parameters<typeof deliveryH5.provisionDelivery>[1],
  ) {
    return deliveryH5.provisionDelivery(this.sb, input);
  }

  async upsertDeliveryEmployment(
    input: Parameters<typeof deliveryH5.upsertDeliveryEmployment>[1],
  ) {
    return deliveryH5.upsertDeliveryEmployment(this.sb, input);
  }

  async listDeliveryBoys() {
    return deliveryH5.listDeliveryBoys(this.sb);
  }

  async getDeliveryBoysSnapshot() {
    return deliveryH5.getDeliveryBoysSnapshot(this.sb);
  }

  async getDeliveryBoyDetail(id: string) {
    return deliveryH5.getDeliveryBoyDetail(this.sb, id);
  }

  async upsertVehicle(input: Parameters<typeof deliveryH5.upsertVehicle>[1]) {
    return deliveryH5.upsertVehicle(this.sb, input);
  }

  async listVehicles() {
    return deliveryH5.listVehicles(this.sb);
  }

  async listDeliveryTimeSlots() {
    return deliveryH5.listDeliveryTimeSlots(this.sb);
  }

  async listReadyForDeliveryOrders() {
    return deliveryH5.listReadyForDeliveryOrders(this.sb);
  }

  async scheduleAndAssignDelivery(
    input: Parameters<typeof deliveryH5.scheduleAndAssignDelivery>[1],
  ) {
    return deliveryH5.scheduleAndAssignDelivery(this.sb, input);
  }

  async recommendDeliveryAssignment(
    serviceAreaId: string,
    deliveryDate: string,
  ) {
    return deliveryH5.recommendDeliveryAssignment(
      this.sb,
      serviceAreaId,
      deliveryDate,
    );
  }

  async settleDeliveryCod(
    input: Parameters<typeof deliveryH5.settleDeliveryCod>[1],
  ) {
    return deliveryH5.settleDeliveryCod(this.sb, input);
  }

  async settleDeliveryCodSelected(
    input: Parameters<typeof deliveryH5.settleDeliveryCodSelected>[1],
  ) {
    return deliveryH5.settleDeliveryCodSelected(this.sb, input);
  }

  async confirmOwnerCodReceipt(
    input: Parameters<typeof deliveryH5.confirmOwnerCodReceipt>[1],
  ) {
    return deliveryH5.confirmOwnerCodReceipt(this.sb, input);
  }

  async confirmOwnerCodReceiptSelected(
    input: Parameters<typeof deliveryH5.confirmOwnerCodReceiptSelected>[1],
  ) {
    return deliveryH5.confirmOwnerCodReceiptSelected(this.sb, input);
  }

  async listDeliveryExceptions(opts?: { openOnly?: boolean }) {
    return deliveryH5.listDeliveryExceptions(this.sb, opts);
  }

  async createDeliveryException(
    input: Parameters<typeof deliveryH5.createDeliveryException>[1],
  ) {
    return deliveryH5.createDeliveryException(this.sb, input);
  }

  async resolveDeliveryException(
    input: Parameters<typeof deliveryH5.resolveDeliveryException>[1],
  ) {
    return deliveryH5.resolveDeliveryException(this.sb, input);
  }

  async getDeliveryOpsDashboard(date?: string) {
    return deliveryH5.getDeliveryOpsDashboard(this.sb, date);
  }

  async listSalesmenWorkingToday(
    today?: string,
  ): Promise<SalesmenWorkingTodaySnapshot> {
    const { data, error } = await this.sb.rpc('admin_salesmen_working_today', {
      p_today: today ?? null,
    });
    if (error) throwRpcError(error, 'Could not load salesmen working today');
    if (data == null || typeof data !== 'object') {
      throw new Error('admin_salesmen_working_today returned empty payload');
    }
    const payload = data as Row;
    const rawList = Array.isArray(payload['salesmen'])
      ? (payload['salesmen'] as Row[])
      : [];
    const salesmen: SalesmanWorkingTodayRow[] = rawList.map((r) => {
      const last = r['last_visit'] as Row | null | undefined;
      return {
        profileId: str(r['profile_id']),
        displayName: str(r['display_name']) || 'Salesman',
        operationalState: str(r['operational_state']) || '—',
        dayStartedAt: r['day_started_at'] ? str(r['day_started_at']) : null,
        dayEndedAt: r['day_ended_at'] ? str(r['day_ended_at']) : null,
        serviceAreaName: r['service_area_name']
          ? str(r['service_area_name'])
          : null,
        assignedShops: num(r['assigned_shops']),
        visitsToday: num(r['visits_today']),
        ordersToday: num(r['orders_today']),
        lastVisit: last
          ? {
              shopName: str(last['shopName'] ?? last['shop_name']),
              visitedAt:
                last['visitedAt'] != null || last['visited_at'] != null
                  ? str(last['visitedAt'] ?? last['visited_at'])
                  : null,
              status: str(last['status']),
            }
          : null,
      };
    });
    return {
      asOfDate: str(payload['asOfDate']),
      salesmen,
    };
  }

  async paymentsOverview(today?: string): Promise<PaymentsOverviewVm> {
    const { data, error } = await this.sb.rpc('admin_payments_overview', {
      p_today: today ?? null,
    });
    if (error) throwRpcError(error, 'Could not load payments overview');
    if (data == null || typeof data !== 'object') {
      throw new Error('admin_payments_overview returned empty payload');
    }
    return formatPaymentsOverview(data as Record<string, unknown>);
  }

  async listPayments(opts?: {
    onlineOnly?: boolean;
    cashOnly?: boolean;
    ofdUnpaidOnly?: boolean;
  }): Promise<PaymentListRow[]> {
    const { data, error } = await this.sb
      .from('payments')
      .select(
        'id, order_id, amount, status, method_intent, collection_method, provider_reference, paid_at, created_at, updated_at, cash_collected_amount, online_collected_amount',
      )
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;

    const payments = (data ?? []) as Row[];
    const orderIds = [
      ...new Set(payments.map((p) => str(p['order_id'])).filter(Boolean)),
    ];
    const orderMap = new Map<string, Row>();
    const shopIds = new Set<string>();
    if (orderIds.length > 0) {
      const { data: orders, error: ordersErr } = await this.sb
        .from('orders')
        .select('id, shop_id, total, status')
        .in('id', orderIds);
      if (ordersErr) throw ordersErr;
      for (const o of orders ?? []) {
        const row = o as Row;
        orderMap.set(str(row['id']), row);
        const sid = str(row['shop_id']);
        if (sid) shopIds.add(sid);
      }
    }
    const shopMap = new Map<string, string>();
    if (shopIds.size > 0) {
      const { data: shops, error: shopsErr } = await this.sb
        .from('shops')
        .select('id, trade_name')
        .in('id', [...shopIds]);
      if (shopsErr) throw shopsErr;
      for (const s of shops ?? []) {
        shopMap.set(str((s as Row)['id']), str((s as Row)['trade_name']));
      }
    }

    const custodyByOrder = new Map<string, Row>();
    const driverIds = new Set<string>();
    if (orderIds.length > 0) {
      const { data: custodyRows, error: custodyErr } = await this.sb
        .from('delivery_cod_custody')
        .select(
          'order_id, delivery_profile_id, amount, status, settlement_id, updated_at',
        )
        .in('order_id', orderIds);
      if (custodyErr) throw custodyErr;
      for (const c of (custodyRows ?? []) as Row[]) {
        custodyByOrder.set(str(c['order_id']), c);
        const pid = str(c['delivery_profile_id']);
        if (pid) driverIds.add(pid);
      }
    }
    const driverMap = new Map<string, string>();
    if (driverIds.size > 0) {
      const { data: profiles, error: profilesErr } = await this.sb
        .from('profiles')
        .select('id, display_name')
        .in('id', [...driverIds]);
      if (profilesErr) throw profilesErr;
      for (const pr of (profiles ?? []) as Row[]) {
        driverMap.set(str(pr['id']), str(pr['display_name']));
      }
    }

    const settlementIds = [
      ...new Set(
        [...custodyByOrder.values()]
          .map((c) => str(c['settlement_id']))
          .filter(Boolean),
      ),
    ];
    const settlementAtMap = new Map<string, string>();
    if (settlementIds.length > 0) {
      const { data: settlements, error: settleErr } = await this.sb
        .from('delivery_cod_settlements')
        .select('id, settled_at, created_at')
        .in('id', settlementIds);
      if (settleErr) throw settleErr;
      for (const s of (settlements ?? []) as Row[]) {
        settlementAtMap.set(
          str(s['id']),
          str(s['settled_at'] ?? s['created_at'] ?? ''),
        );
      }
    }

    const bankConfigured = true;

    const rows: PaymentListRow[] = [];
    for (const p of payments) {
      const status = normalizePaymentStatus(str(p['status']));
      const methodIntent = p['method_intent'] ? str(p['method_intent']) : null;
      const collectionMethod = p['collection_method']
        ? str(p['collection_method'])
        : null;
      if (
        opts?.onlineOnly &&
        !isOnlinePaymentMethod({ methodIntent, collectionMethod })
      ) {
        continue;
      }
      if (
        opts?.cashOnly &&
        !isCashOrCodPaymentMethod({ methodIntent, collectionMethod })
      ) {
        continue;
      }
      const orderId = str(p['order_id']);
      const order = orderMap.get(orderId);
      const orderStatus = order ? str(order['status']) : null;
      const cashCollected = num(p['cash_collected_amount']);
      const onlineCollected = num(p['online_collected_amount']);
      const residual = Math.max(
        num(p['amount']) - cashCollected - onlineCollected,
        0,
      );
      if (opts?.ofdUnpaidOnly) {
        if (orderStatus !== 'OUT_FOR_DELIVERY') continue;
        if (status === 'PAID' || residual <= 0) continue;
      }
      const shopId = order ? str(order['shop_id']) : '';
      const providerReference = p['provider_reference']
        ? str(p['provider_reference'])
        : null;
      const recon = reconcilePaymentStatus({
        status,
        providerReference,
        bankConfirmationConfigured: bankConfigured,
      });
      const methodLabel = collectionMethod
        ? collectionMethodLabel(collectionMethod)
        : methodIntent === 'PAY_ONLINE_NOW'
          ? 'Online'
          : methodIntent === 'PAY_ON_DELIVERY'
            ? 'Pay on delivery'
            : '—';
      const custody = custodyByOrder.get(orderId);
      const custodyStatus = custody ? str(custody['status']) : null;
      const driverId = custody ? str(custody['delivery_profile_id']) : '';
      const settlementId = custody ? str(custody['settlement_id']) : '';
      const settledAt = settlementId
        ? settlementAtMap.get(settlementId)
        : undefined;
      let settlementStatusLabel = '—';
      if (custodyStatus === 'WITH_DRIVER') {
        settlementStatusLabel = 'With Delivery Boy';
      } else if (
        custodyStatus === 'RECEIVED_BY_MANAGER' ||
        custodyStatus === 'HANDED_TO_COMPANY'
      ) {
        settlementStatusLabel = 'Received by Manager';
      } else if (
        custodyStatus === 'RECEIVED_BY_OWNER' ||
        custodyStatus === 'RECONCILED'
      ) {
        settlementStatusLabel = 'Received by Owner';
      } else if (onlineCollected > 0 && cashCollected <= 0) {
        settlementStatusLabel = 'Online / company flow';
      } else if (
        status === 'PAYMENT_PENDING' &&
        collectionMethod &&
        collectionMethod !== 'CASH_ON_DELIVERY'
      ) {
        settlementStatusLabel = 'Bank/UPI awaiting verification';
      }
      const custodyStatusLabel =
        custodyStatus === 'WITH_DRIVER'
          ? 'With Delivery Boy'
          : custodyStatus === 'RECEIVED_BY_MANAGER'
            ? 'Received by Manager'
            : custodyStatus === 'RECEIVED_BY_OWNER'
              ? 'Received by Owner'
              : custodyStatus === 'HANDED_TO_COMPANY'
                ? 'Received by Manager'
                : custodyStatus === 'RECONCILED'
                  ? 'Received by Owner'
                  : custodyStatus
                    ? custodyStatus.replace(/_/g, ' ')
                    : '—';
      const customerPaymentLabel =
        status === 'PAYMENT_PENDING' &&
        collectionMethod &&
        collectionMethod !== 'CASH_ON_DELIVERY'
          ? 'Awaiting verification'
          : status === 'UNPAID'
            ? 'Customer unpaid'
            : status === 'PAID'
              ? 'Customer paid'
              : status.replace(/_/g, ' ');
      rows.push({
        id: str(p['id']),
        orderId,
        orderCode: shortCode(orderId, 'GA'),
        shopName: shopMap.get(shopId) || '—',
        amount: num(p['amount']),
        amountLabel: formatInr(num(p['amount'])),
        status,
        statusLabel: status.replace(/_/g, ' '),
        methodIntent,
        collectionMethod,
        methodLabel,
        cashCollected,
        cashCollectedLabel: formatInr(cashCollected),
        onlineCollected,
        onlineCollectedLabel: formatInr(onlineCollected),
        customerPaymentLabel,
        collectedByLabel: driverId ? driverMap.get(driverId) || '—' : '—',
        custodyStatus,
        custodyStatusLabel,
        settlementStatusLabel,
        settledAtLabel: settledAt ? formatDateTime(settledAt) : '—',
        orderStatus,
        providerReference,
        paidAtLabel: p['paid_at'] ? formatDateTime(str(p['paid_at'])) : '—',
        createdAtLabel: formatDateTime(str(p['created_at'])),
        reconciliationStatus: recon,
        reconciliationLabel: reconciliationStatusLabel(recon),
      });
    }
    return rows;
  }

  async listPaymentSettlements(): Promise<PaymentSettlementVm[]> {
    const custody = await this.listCodCustodySummaries();
    return custody.map((c) => ({
      deliveryProfileId: c.deliveryProfileId,
      driverName: c.driverName,
      withDriverAmount: c.withDriverAmount,
      withDriverLabel: c.withDriverLabel,
      withManagerAmount: c.withManagerAmount,
      withManagerLabel: c.withManagerLabel,
      collectedAmount: c.collectedAmount,
      collectedLabel: c.collectedLabel,
      adminSettledAmount: c.adminSettledAmount,
      adminSettledLabel: c.adminSettledLabel,
      orderCount: c.orderCount,
      handedOverAmount: c.handedOverAmount,
      settledAmount: c.settledAmount,
    }));
  }

  async listOrderScheduleEvents(orderId: string) {
    return deliveryH5.listOrderScheduleEvents(this.sb, orderId);
  }

  async listOrderNotificationEvents(orderId: string) {
    return deliveryH5.listOrderNotificationEvents(this.sb, orderId);
  }

  async listCodCustodySummaries() {
    return deliveryH5.listCodCustodySummaries(this.sb);
  }

  async listCodCustodyCollections(
    opts?: Parameters<typeof deliveryH5.listCodCustodyCollections>[1],
  ) {
    return deliveryH5.listCodCustodyCollections(this.sb, opts);
  }

  async listManagerCodCustodyBreakdown() {
    return deliveryH5.listManagerCodCustodyBreakdown(this.sb);
  }

  async deliveryProviderConfigured() {
    return deliveryH5.deliveryProviderConfigured(this.sb);
  }

  /** Alias for deliverySnapshot (H5 naming). */
  async getDeliverySnapshot(): Promise<DeliverySnapshot> {
    return this.deliverySnapshot();
  }

  /** Alias for deliveryDetail (H5 naming). */
  async getDeliveryRouteDetail(
    id: string,
  ): Promise<DeliveryRouteDetail | null> {
    return this.deliveryDetail(id);
  }

  // ─── Delivery ───────────────────────────────────────────────────────

  async deliverySnapshot(): Promise<DeliverySnapshot> {
    const { data: routes } = await this.sb
      .from('delivery_routes')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (!routes?.length) {
      return { generatedAtLabel: formatDateTime(new Date().toISOString()), kpis: [], rows: [] };
    }

    const { data: profiles } = await this.sb.from('profiles').select('id, display_name');
    const profileMap = new Map((profiles ?? []).map((pr) => [pr.id, str(pr.display_name)]));

    const { data: areas } = await this.sb.from('service_areas').select('id, name');
    const areaMap = new Map((areas ?? []).map((a) => [str((a as unknown as Row)['id']), str((a as unknown as Row)['name'])]));

    const vehicleIds = [
      ...new Set(
        (routes as Row[])
          .map((r) => str(r['vehicle_id']))
          .filter(Boolean),
      ),
    ];
    const vehicleMap = await deliveryH5.vehicleLabelMap(this.sb, vehicleIds);

    const routeIds = (routes as Row[]).map((r) => str(r['id']));
    const { data: stops } = await this.sb
      .from('route_stops')
      .select('route_id, order_id')
      .in('route_id', routeIds);
    const stopCountMap = new Map<string, number>();
    const orderIdsInRoutes = new Set<string>();
    for (const st of (stops ?? []) as Row[]) {
      const rid = str(st['route_id']);
      stopCountMap.set(rid, (stopCountMap.get(rid) ?? 0) + 1);
      orderIdsInRoutes.add(str(st['order_id']));
    }

    const orderIdsList = [...orderIdsInRoutes];
    const { data: routePayments } = orderIdsList.length
      ? await this.sb
          .from('payments')
          .select('order_id, method_intent, collection_method, status, amount')
          .in('order_id', orderIdsList)
      : { data: [] as Row[] };

    const paymentByOrder = new Map<string, PaymentLike>();
    for (const p of (routePayments ?? []) as Row[]) {
      paymentByOrder.set(str(p['order_id']), p as PaymentLike);
    }

    const codByRoute = new Map<string, number>();
    for (const st of (stops ?? []) as Row[]) {
      const rid = str(st['route_id']);
      const pay = paymentByOrder.get(str(st['order_id']));
      if (!pay || !isOnDeliveryPayment(pay)) continue;
      const amt = num(pay.amount);
      codByRoute.set(rid, (codByRoute.get(rid) ?? 0) + amt);
    }

    const rows: DeliveryRouteListRow[] = (routes as Row[]).map((r) => {
      const rid = str(r['id']);
      const vid = str(r['vehicle_id']);
      return {
        id: rid,
        routeCode: shortCode(rid, 'RT'),
        driverName: profileMap.get(str(r['assigned_delivery_profile_id'])) ?? '—',
        vehicleLabel: vid ? (vehicleMap.get(vid) ?? '—') : '—',
        deliveryArea: areaMap.get(str(r['service_area_id'])) ?? '—',
        ordersAssigned: stopCountMap.get(rid) ?? 0,
        codAmountLabel: formatInr(codByRoute.get(rid) ?? 0),
        status: mapRouteStatus(str(r['status'])),
        updatedAtLabel: formatDateTime(str(r['updated_at'])),
      };
    });

    const totalRoutes = rows.length;
    const running = rows.filter((r) => r.status === 'running').length;
    const completed = rows.filter((r) => r.status === 'completed').length;

    return {
      generatedAtLabel: formatDateTime(new Date().toISOString()),
      kpis: [
        { id: 'total', label: 'Total Routes', value: `${totalRoutes}` },
        { id: 'running', label: 'Running', value: `${running}`, tone: 'positive' },
        { id: 'completed', label: 'Completed', value: `${completed}` },
        { id: 'planned', label: 'Planned', value: `${rows.filter((r) => r.status === 'planned').length}`, tone: 'warning' },
      ],
      rows,
    };
  }

  async deliveryDetail(id: string): Promise<DeliveryRouteDetail | null> {
    const { data: route } = await this.sb
      .from('delivery_routes')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();
    if (!route) return null;
    const r = route as unknown as Row;

    const { data: profiles } = await this.sb.from('profiles').select('id, display_name');
    const profileMap = new Map((profiles ?? []).map((pr) => [pr.id, str(pr.display_name)]));

    const { data: areas } = await this.sb.from('service_areas').select('id, name');
    const areaMap = new Map((areas ?? []).map((a) => [str((a as unknown as Row)['id']), str((a as unknown as Row)['name'])]));

    const { data: stops } = await this.sb
      .from('route_stops')
      .select('*')
      .eq('route_id', id)
      .order('sequence', { ascending: true });

    const stopRows = (stops ?? []) as Row[];
    const orderIds = stopRows.map((st) => str(st['order_id']));
    const stopIds = stopRows.map((st) => str(st['id']));

    const { data: ordersData } = orderIds.length
      ? await this.sb.from('orders').select('*').in('id', orderIds)
      : { data: [] as Row[] };
    const orderMap = new Map((ordersData ?? []).map((o) => [str((o as unknown as Row)['id']), o as Row]));

    const shopIds = [...new Set((ordersData ?? []).map((o) => str((o as unknown as Row)['shop_id'])))];
    const { data: shops } = shopIds.length
      ? await this.sb.from('shops').select('*').in('id', shopIds).is('deleted_at', null)
      : { data: [] as Row[] };
    const shopMap = new Map((shops ?? []).map((s) => [str((s as unknown as Row)['id']), s as unknown as Row]));

    const { data: paymentsData } = orderIds.length
      ? await this.sb.from('payments').select('*').in('order_id', orderIds)
      : { data: [] as Row[] };
    const paymentByOrder = new Map<string, PaymentLike>();
    for (const p of (paymentsData ?? []) as Row[]) {
      paymentByOrder.set(str(p['order_id']), p as PaymentLike);
    }

    const { data: orderEvents } = orderIds.length
      ? await this.sb
          .from('order_events')
          .select('id, order_id, to_status, note, created_at')
          .in('order_id', orderIds)
          .order('created_at', { ascending: true })
      : { data: [] as Row[] };

    const { data: attempts } = stopIds.length
      ? await this.sb
          .from('delivery_attempts')
          .select('id, route_stop_id, succeeded, failure_reason, attempted_at, delivery_notes')
          .in('route_stop_id', stopIds)
          .order('attempted_at', { ascending: true })
      : { data: [] as Row[] };

    const assignedOrders: DeliveryAssignedOrder[] = stopRows.map((st) => {
      const orderId = str(st['order_id']);
      const order = orderMap.get(orderId);
      const shopId = order ? str(order['shop_id']) : '';
      const shop = shopMap.get(shopId);
      const mappedStop = mapDbRouteStopStatusToUi(st['status']);
      const payment = paymentByOrder.get(orderId) ?? null;
      const collectable = isCodCollectable(payment);
      const suggested =
        collectable && payment ? num(payment.amount) : null;
      return {
        id: str(st['id']),
        orderId,
        orderCode: shortCode(orderId, 'GA'),
        customerName: shop ? str(shop['trade_name']) : '—',
        areaLabel: shop ? (areaMap.get(str(shop['service_area_id'])) ?? '—') : '—',
        amountLabel: order ? formatInr(num(order['total'])) : '—',
        paymentTypeLabel: paymentTypeLabelFromPayment(payment),
        codCollectable: collectable,
        codSuggestedAmount:
          suggested != null && Number.isFinite(suggested) ? suggested : null,
        deliveryStatus: mappedStop.deliveryStatus,
        deliveryStatusLabel: mappedStop.deliveryStatusLabel,
      };
    });

    const routeStatus = mapRouteStatus(str(r['status']));

    const vehicleId = str(r['vehicle_id']) || null;
    const timeSlotId = str(r['time_slot_id']) || null;
    let vehicleNumber = '—';
    let capacityLabel = '—';
    let vehicleUiStatus = mapDbVehicleStatusToUi(
      routeStatus === 'running' ? 'ON_ROUTE' : 'AVAILABLE',
    );
    if (vehicleId) {
      const { data: veh } = await this.sb
        .from('vehicles')
        .select('vehicle_number, capacity_label, status')
        .eq('id', vehicleId)
        .maybeSingle();
      if (veh) {
        const v = veh as unknown as Row;
        vehicleNumber = str(v['vehicle_number']) || '—';
        capacityLabel = str(v['capacity_label']) || '—';
        vehicleUiStatus = mapDbVehicleStatusToUi(str(v['status']));
      }
    }
    let timeSlotLabel: string | null = null;
    if (timeSlotId) {
      const { data: slot } = await this.sb
        .from('delivery_time_slots')
        .select('label')
        .eq('id', timeSlotId)
        .maybeSingle();
      if (slot) timeSlotLabel = str((slot as unknown as Row)['label']) || null;
    }

    const startEventAts = ((orderEvents ?? []) as Row[])
      .filter((ev) => {
        const to = str(ev['to_status']);
        const note = str(ev['note']).toLowerCase();
        return (
          to === 'OUT_FOR_DELIVERY' &&
          (note.includes('route started') || note.includes('out for delivery'))
        );
      })
      .map((ev) => str(ev['created_at']))
      .filter(Boolean);
    const routeStartedAtIso = startEventAts.length
      ? startEventAts.reduce((a, b) => (a < b ? a : b))
      : null;

    const stopById = new Map(stopRows.map((st) => [str(st['id']), st]));
    const timelineStopEvents = [
      ...((attempts ?? []) as Row[]).map((att) => {
        const stopId = str(att['route_stop_id']);
        const stop = stopById.get(stopId);
        const orderId = stop ? str(stop['order_id']) : '';
        const orderCode = orderId ? shortCode(orderId, 'GA') : stopId.slice(0, 8);
        const succeeded = Boolean(att['succeeded']);
        return {
          id: `attempt-${str(att['id'])}`,
          label: succeeded
            ? `Delivery attempt · ${orderCode}`
            : `Failed attempt · ${orderCode}`,
          atIso: str(att['attempted_at']),
          note: succeeded
            ? undefined
            : str(att['failure_reason']) || str(att['delivery_notes']) || undefined,
        };
      }),
      ...stopRows
        .filter((st) => {
          const status = str(st['status']);
          return (
            status === 'COMPLETED' ||
            status === 'FAILED' ||
            status === 'SKIPPED'
          );
        })
        .map((st) => {
          const orderId = str(st['order_id']);
          const orderCode = shortCode(orderId, 'GA');
          const status = str(st['status']);
          const label =
            status === 'COMPLETED'
              ? `Stop delivered · ${orderCode}`
              : status === 'FAILED'
                ? `Stop failed · ${orderCode}`
                : `Stop skipped · ${orderCode}`;
          return {
            id: `stop-${str(st['id'])}`,
            label,
            atIso: str(st['updated_at'] ?? st['created_at']),
          };
        }),
    ].filter((ev) => Boolean(ev.atIso));

    const timeline = buildDeliveryRouteTimeline({
      routeStatus,
      createdAtIso: str(r['created_at']),
      updatedAtIso: str(r['updated_at']),
      routeStartedAtIso,
      formatDateTime,
      stopEvents: timelineStopEvents,
    });

    const routePayments = [...paymentByOrder.values()];
    const codSummary = summarizeCodFromPayments(routePayments);

    const collectionHistory: DeliveryCollectionRow[] = routePayments
      .filter((p) => isOnDeliveryPayment(p) && String(p.status ?? '') === 'PAID')
      .map((p) => {
        const orderId = str(p.order_id);
        const order = orderMap.get(orderId);
        const shop = order ? shopMap.get(str(order['shop_id'])) : undefined;
        const method = str(p.collection_method);
        return {
          id: str(p.id ?? orderId),
          orderCode: shortCode(orderId, 'GA'),
          customerName: shop ? str(shop['trade_name']) : '—',
          amountLabel: formatInr(num(p.amount)),
          statusLabel: `Paid · ${collectionMethodLabel(method)}`,
          atLabel: p.paid_at ? formatDateTime(str(p.paid_at)) : '—',
        };
      })
      .sort((a, b) => a.atLabel.localeCompare(b.atLabel));

    const deliveredOrders = assignedOrders.filter(
      (o) => o.deliveryStatus === 'delivered',
    );

    return {
      id: str(r['id']),
      routeCode: shortCode(str(r['id']), 'RT'),
      routeNumberLabel: shortCode(str(r['id']), 'RT'),
      serviceAreaId: str(r['service_area_id']),
      assignedDeliveryProfileId: r['assigned_delivery_profile_id']
        ? str(r['assigned_delivery_profile_id'])
        : null,
      driverName: profileMap.get(str(r['assigned_delivery_profile_id'])) ?? '—',
      vehicleLabel: vehicleNumber,
      warehouseName: '—',
      deliveryArea: areaMap.get(str(r['service_area_id'])) ?? '—',
      departureTimeLabel: timeSlotLabel ?? '—',
      expectedCompletionLabel: '—',
      status: routeStatus,
      updatedAtLabel: formatDateTime(str(r['updated_at'])),
      assignedOrders,
      timeline,
      collections: {
        codExpectedLabel: formatInr(codSummary.expected),
        codCollectedLabel: formatInr(codSummary.collected),
        pendingCollectionLabel: formatInr(codSummary.pending),
      },
      collectionHistory,
      performance: {
        ordersDelivered: deliveredOrders.length,
        deliverySuccessRateLabel: assignedOrders.length
          ? `${Math.round((deliveredOrders.length / assignedOrders.length) * 100)}%`
          : '0%',
        averageDeliveryTimeLabel: '—',
        failedDeliveries: assignedOrders.filter((o) => o.deliveryStatus === 'failed')
          .length,
        customerRatingLabel: '—',
      },
      vehicle: {
        vehicleNumber,
        driverName: profileMap.get(str(r['assigned_delivery_profile_id'])) ?? '—',
        capacityLabel,
        status: vehicleUiStatus.status,
        statusLabel: vehicleUiStatus.statusLabel,
      },
      vehicleId,
      timeSlotId,
      timeSlotLabel,
      routeDate: str(r['route_date']) || null,
    };
  }

  // ─── Dashboard ──────────────────────────────────────────────────────

  async dashboardSnapshot(): Promise<DashboardSnapshot> {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayDate = toDateOnly(now);
    const todayEndIso = new Date(todayStart.getTime() + 86400000).toISOString();
    const staleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lowStockThreshold = 10;

    // Executive KPIs MUST come from RPC — throw on error (never fabricate zeros).
    const { data: kpiRaw, error: kpiError } = await this.sb.rpc(
      'admin_ops_dashboard_kpis',
      { p_today: todayDate },
    );
    if (kpiError) throwRpcError(kpiError, 'Could not load dashboard KPIs');
    const executiveKpis = mapOpsDashboardKpisToExecutive(
      parseOpsDashboardKpisRpc(kpiRaw),
    );

    const [
      ordersRes,
      shopsRes,
      balancesRes,
      paymentsRes,
      visitsRes,
      orderEventsRes,
      paymentEventsRes,
      movementsRes,
      recentProductsRes,
      recentPricesRes,
      recentShopsRes,
      skusRes,
      purchasesRes,
    ] = await Promise.all([
      this.sb
        .from('orders')
        .select(
          'id, shop_id, total, status, created_at, updated_at, created_by_profile_id',
        ),
      this.sb
        .from('shops')
        .select('id, trade_name, lifecycle_status, is_active, created_at')
        .is('deleted_at', null),
      this.sb.from('inventory_balances').select('sku_id, available_quantity'),
      this.sb
        .from('payments')
        .select(
          'id, amount, status, order_id, paid_at, updated_at, cash_collected_amount, online_collected_amount',
        ),
      this.sb
        .from('sales_visits')
        .select(
          'id, salesman_profile_id, shop_id, status, planned_at, visited_at, created_at',
        )
        .or(
          `and(planned_at.gte.${todayStart.toISOString()},planned_at.lt.${todayEndIso}),and(visited_at.gte.${todayStart.toISOString()},visited_at.lt.${todayEndIso})`,
        ),
      this.sb
        .from('order_events')
        .select(
          'id, order_id, from_status, to_status, actor_profile_id, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(25),
      this.sb
        .from('payment_events')
        .select(
          'id, payment_id, from_status, to_status, actor_profile_id, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(20),
      this.sb
        .from('inventory_movements')
        .select(
          'id, sku_id, movement_type, quantity_delta, actor_profile_id, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(15),
      this.sb
        .from('products')
        .select('id, name, created_at')
        .order('created_at', { ascending: false })
        .limit(8),
      this.sb
        .from('sku_prices')
        .select('id, sku_id, trade_price, recorded_by_profile_id, created_at')
        .order('created_at', { ascending: false })
        .limit(8),
      this.sb
        .from('shops')
        .select('id, trade_name, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(8),
      this.sb.from('skus').select('id, name, sku_code'),
      this.sb.from('purchases').select('id, status'),
    ]);

    if (ordersRes.error) throw ordersRes.error;
    if (shopsRes.error) throw shopsRes.error;
    if (paymentsRes.error) throw paymentsRes.error;
    if (purchasesRes.error) throw purchasesRes.error;

    const orders = (ordersRes.data ?? []) as Row[];
    const shops = (shopsRes.data ?? []) as Row[];
    const balances = (balancesRes.data ?? []) as Row[];
    const payments = (paymentsRes.data ?? []) as Row[];
    const visits = (visitsRes.data ?? []) as Row[];
    const orderEvents = (orderEventsRes.data ?? []) as Row[];
    const paymentEvents = (paymentEventsRes.data ?? []) as Row[];
    const movements = (movementsRes.data ?? []) as Row[];
    const recentProducts = (recentProductsRes.data ?? []) as Row[];
    const recentPrices = (recentPricesRes.data ?? []) as Row[];
    const recentShops = (recentShopsRes.data ?? []) as Row[];
    const skus = (skusRes.data ?? []) as Row[];
    const purchases = (purchasesRes.data ?? []) as Row[];
    const skuMap = new Map(
      skus.map((s) => [
        str(s['id']),
        { name: str(s['name']), code: str(s['sku_code']) },
      ]),
    );

    const paymentById = new Map<string, Row>();
    for (const p of payments) {
      paymentById.set(str(p['id']), p);
    }

    const isPendingDbStatus = (status: string) =>
      status === 'DRAFT_ASSISTED' ||
      status === 'AWAITING_CUSTOMER_CONFIRMATION' ||
      status === 'CONFIRMED' ||
      status === 'STOCK_RESERVED' ||
      status === 'PROCESSING' ||
      status === 'READY_FOR_DISPATCH';

    const isPackedDbStatus = (status: string) =>
      status === 'READY_FOR_DISPATCH' || status === 'ASSIGNED_TO_ROUTE';

    const nonCancelled = orders.filter((o) => str(o['status']) !== 'CANCELLED');

    const todayOrders = nonCancelled.filter((o) =>
      isSameCalendarDay(str(o['created_at']), now),
    );

    const pendingOrderCount = orders.filter((o) =>
      isPendingDbStatus(str(o['status'])),
    ).length;

    const operations: OperationsMetric[] = [
      {
        id: 'new_today',
        label: 'New Orders Today',
        count: todayOrders.length,
        href: ordersPresetHref('new_today'),
      },
      {
        id: 'pending',
        label: 'Pending Orders',
        count: pendingOrderCount,
        href: ordersPresetHref('pending'),
      },
      {
        id: 'packed',
        label: 'Orders Packed',
        count: orders.filter((o) => isPackedDbStatus(str(o['status']))).length,
        href: ordersPresetHref('packed'),
      },
      {
        id: 'out_for_delivery',
        label: 'Out for Delivery',
        count: orders.filter((o) => str(o['status']) === 'OUT_FOR_DELIVERY').length,
        href: ordersPresetHref('out_for_delivery'),
      },
      {
        id: 'delivered_today',
        label: 'Delivered Today',
        count: orders.filter(
          (o) =>
            str(o['status']) === 'DELIVERED' &&
            isSameCalendarDay(str(o['updated_at']), now),
        ).length,
        href: ordersPresetHref('delivered_today'),
      },
    ];

    const lowStockCount = balances.filter(
      (b) => num(b['available_quantity']) > 0 && num(b['available_quantity']) < lowStockThreshold,
    ).length;

    const stalePendingCount = orders.filter((o) => {
      if (!isPendingDbStatus(str(o['status']))) return false;
      return new Date(str(o['created_at'])) < staleThreshold;
    }).length;

    const failedDeliveryCount = orders.filter(
      (o) => str(o['status']) === 'DELIVERY_FAILED',
    ).length;

    const pendingPaymentCount = payments.filter((p) => {
      const st = str(p['status']);
      return st === 'UNPAID' || st === 'PAYMENT_PENDING';
    }).length;

    const paymentByOrderId = new Map<string, Row>();
    for (const p of payments) {
      paymentByOrderId.set(str(p['order_id']), p);
    }

    const deliveredUnpaidCount = orders.filter((o) => {
      if (str(o['status']) !== 'DELIVERED') return false;
      const p = paymentByOrderId.get(str(o['id']));
      if (!p) return true;
      const st = str(p['status']);
      return st !== 'PAID';
    }).length;

    const amountMismatchCount = payments.filter((p) => {
      const due = num(p['amount']);
      const cash = num(p['cash_collected_amount']);
      const online = num(p['online_collected_amount']);
      return cash + online > due + 1e-9;
    }).length;
    const draftPurchaseCount = purchases.filter(
      (purchase) => str(purchase['status']) === 'DRAFT',
    ).length;

    const attentionAlerts: AttentionAlert[] = [];
    if (lowStockCount > 0) {
      attentionAlerts.push({
        id: 'low_stock',
        title: 'Low Stock Products',
        count: lowStockCount,
        severity: 'high',
        href: '/inventory?status=low',
      });
    }
    if (stalePendingCount > 0) {
      attentionAlerts.push({
        id: 'stale_pending',
        title: 'Orders Pending Over 24 Hours',
        count: stalePendingCount,
        severity: 'high',
        href: ordersPresetHref('pending'),
      });
    }
    if (failedDeliveryCount > 0) {
      attentionAlerts.push({
        id: 'failed_delivery',
        title: 'Failed Deliveries',
        count: failedDeliveryCount,
        severity: 'high',
        href: '/delivery',
      });
    }
    if (deliveredUnpaidCount > 0) {
      attentionAlerts.push({
        id: 'delivered_unpaid',
        title: 'Delivered but payment unpaid',
        count: deliveredUnpaidCount,
        severity: 'high',
        href: '/payments?tab=all',
      });
    }
    if (amountMismatchCount > 0) {
      attentionAlerts.push({
        id: 'payment_amount_mismatch',
        title: 'Payment amount mismatch',
        count: amountMismatchCount,
        severity: 'high',
        href: '/payments?tab=all',
      });
    }
    if (pendingPaymentCount > 0) {
      attentionAlerts.push({
        id: 'pending_payments',
        title: 'Pending customer payments',
        count: pendingPaymentCount,
        severity: 'medium',
        href: '/payments?tab=all',
      });
    }
    if (draftPurchaseCount > 0) {
      attentionAlerts.push({
        id: 'draft_purchases',
        title: 'Purchase drafts waiting',
        count: draftPurchaseCount,
        severity: 'medium',
        href: '/purchases',
      });
    }
    const quickActions: DashboardQuickAction[] = [
      {
        id: 'new_sale',
        label: 'New Sale',
        description: 'Create an assisted customer order',
      },
      {
        id: 'new_purchase',
        label: 'New Purchase',
        description: 'Record a supplier bill and receive stock',
        href: '/purchases/new',
      },
      {
        id: 'record_expense',
        label: 'Record Expense',
        description: 'Add business money spent',
        href: '/expenses?create=1',
      },
      {
        id: 'collect_payment',
        label: 'Collect Payment',
        description: 'Open customer balances awaiting collection',
        href: '/payments?tab=all&focus=ofd_unpaid',
      },
    ];

    const actorIds = new Set<string>();
    for (const e of orderEvents) {
      const aid = str(e['actor_profile_id']);
      if (aid) actorIds.add(aid);
    }
    for (const e of paymentEvents) {
      const aid = str(e['actor_profile_id']);
      if (aid) actorIds.add(aid);
    }
    for (const m of movements) {
      const aid = str(m['actor_profile_id']);
      if (aid) actorIds.add(aid);
    }
    for (const p of recentPrices) {
      const aid = str(p['recorded_by_profile_id']);
      if (aid) actorIds.add(aid);
    }
    for (const o of orders.slice(0, 20)) {
      const aid = str(o['created_by_profile_id']);
      if (aid) actorIds.add(aid);
    }
    for (const v of visits) {
      const aid = str(v['salesman_profile_id']);
      if (aid) actorIds.add(aid);
    }

    const profileMap = new Map<string, string>();
    if (actorIds.size > 0) {
      const { data: profiles } = await this.sb
        .from('profiles')
        .select('id, display_name')
        .in('id', [...actorIds]);
      for (const pr of profiles ?? []) {
        profileMap.set(
          str((pr as Row)['id']),
          str((pr as Row)['display_name']) || 'Staff',
        );
      }
    }

    const activity: BusinessActivityItem[] = [];

    const pushActivity = (
      item: Omit<BusinessActivityItem, 'id'> & { id?: string },
    ) => {
      activity.push({
        id: item.id ?? `${item.kind}-${item.occurredAt}-${activity.length}`,
        kind: item.kind,
        title: item.title,
        detail: item.detail,
        actorLabel: item.actorLabel,
        timestampLabel: item.timestampLabel,
        occurredAt: item.occurredAt,
        href: item.href,
      });
    };

    for (const e of orderEvents) {
      const toStatus = str(e['to_status']);
      const orderId = str(e['order_id']);
      const occurredAt = str(e['created_at']);
      const actor = profileMap.get(str(e['actor_profile_id']));
      let kind: BusinessActivityKind | null = null;
      let title = '';
      if (toStatus === 'CANCELLED') {
        kind = 'order_cancelled';
        title = 'Order Cancelled';
      } else if (toStatus === 'DELIVERED') {
        kind = 'delivery_completed';
        title = 'Delivery Completed';
      }
      if (!kind) continue;
      pushActivity({
        id: str(e['id']),
        kind,
        title,
        detail: `Order ${shortCode(orderId, 'GA')}`,
        actorLabel: actor,
        timestampLabel: formatDateTime(occurredAt),
        occurredAt,
        href: `/orders/${orderId}`,
      });
    }

    for (const o of [...orders]
      .sort((a, b) => str(b['created_at']).localeCompare(str(a['created_at'])))
      .slice(0, 12)) {
      const orderId = str(o['id']);
      const occurredAt = str(o['created_at']);
      if (str(o['status']) === 'CANCELLED') continue;
      pushActivity({
        id: `order-new-${orderId}`,
        kind: 'order_created',
        title: 'Order Created',
        detail: `Order ${shortCode(orderId, 'GA')} · ${formatInr(num(o['total']))}`,
        actorLabel: profileMap.get(str(o['created_by_profile_id'])),
        timestampLabel: formatDateTime(occurredAt),
        occurredAt,
        href: `/orders/${orderId}`,
      });
    }

    for (const e of paymentEvents) {
      const toStatus = str(e['to_status']);
      const payment = paymentById.get(str(e['payment_id']));
      const orderId = payment ? str(payment['order_id']) : '';
      const occurredAt = str(e['created_at']);
      const amount = payment ? formatInr(num(payment['amount'])) : '';
      if (toStatus === 'PAID') {
        pushActivity({
          id: str(e['id']),
          kind: 'payment_received',
          title: 'Payment Received',
          detail: orderId
            ? `Order ${shortCode(orderId, 'GA')}${amount ? ` · ${amount}` : ''}`
            : amount || 'Payment collected',
          actorLabel: profileMap.get(str(e['actor_profile_id'])),
          timestampLabel: formatDateTime(occurredAt),
          occurredAt,
          href: orderId ? `/orders/${orderId}` : '/orders?payment=PAID',
        });
      } else if (toStatus === 'UNPAID' || toStatus === 'PAYMENT_PENDING') {
        pushActivity({
          id: str(e['id']),
          kind: 'payment_pending',
          title: 'Payment Pending',
          detail: orderId
            ? `Order ${shortCode(orderId, 'GA')}${amount ? ` · ${amount}` : ''}`
            : amount || 'Awaiting collection',
          actorLabel: profileMap.get(str(e['actor_profile_id'])),
          timestampLabel: formatDateTime(occurredAt),
          occurredAt,
          href: orderId ? `/orders/${orderId}` : pendingPaymentsTodayHref(now),
        });
      }
    }

    for (const m of movements) {
      const skuId = str(m['sku_id']);
      const sku = skuMap.get(skuId);
      const occurredAt = str(m['created_at']);
      pushActivity({
        id: str(m['id']),
        kind: 'stock_updated',
        title: 'Stock Updated',
        detail: sku ? `${sku.name} (${sku.code})` : 'Inventory movement',
        actorLabel: profileMap.get(str(m['actor_profile_id'])),
        timestampLabel: formatDateTime(occurredAt),
        occurredAt,
        href: skuId ? `/inventory/${skuId}` : '/inventory',
      });
    }

    for (const p of recentProducts) {
      const occurredAt = str(p['created_at']);
      pushActivity({
        id: `product-${str(p['id'])}`,
        kind: 'product_added',
        title: 'Product Added',
        detail: str(p['name']),
        timestampLabel: formatDateTime(occurredAt),
        occurredAt,
        href: `/products/${str(p['id'])}`,
      });
    }

    for (const pr of recentPrices) {
      const skuId = str(pr['sku_id']);
      const sku = skuMap.get(skuId);
      const occurredAt = str(pr['created_at']);
      pushActivity({
        id: str(pr['id']),
        kind: 'price_updated',
        title: 'Price Updated',
        detail: sku
          ? `${sku.name} → ${formatInr(num(pr['trade_price']))}`
          : formatInr(num(pr['trade_price'])),
        actorLabel: profileMap.get(str(pr['recorded_by_profile_id'])),
        timestampLabel: formatDateTime(occurredAt),
        occurredAt,
        href: skuId ? `/pricing/${skuId}` : '/pricing',
      });
    }

    for (const s of recentShops) {
      const occurredAt = str(s['created_at']);
      pushActivity({
        id: `shop-${str(s['id'])}`,
        kind: 'customer_registered',
        title: 'Customer Added',
        detail: str(s['trade_name']),
        timestampLabel: formatDateTime(occurredAt),
        occurredAt,
        href: `/customers/${str(s['id'])}`,
      });
    }

    for (const v of visits) {
      if (str(v['status']) !== 'VISITED' || !v['visited_at']) continue;
      const salesmanId = str(v['salesman_profile_id']);
      const occurredAt = str(v['visited_at']);
      const shop = shops.find((s) => str(s['id']) === str(v['shop_id']));
      pushActivity({
        id: `visit-${str(v['id'])}`,
        kind: 'salesman_check_in',
        title: 'Salesman Check-in',
        detail: shop ? str(shop['trade_name']) : 'Retailer visit',
        actorLabel: profileMap.get(salesmanId),
        timestampLabel: formatDateTime(occurredAt),
        occurredAt,
        href: salesmanId ? `/salesmen/${salesmanId}` : '/salesmen',
      });
    }

    const recentActivity = activity
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, 10);

    return {
      generatedAtLabel: `Updated ${formatDateTime(now.toISOString())}`,
      executiveKpis,
      operations,
      attentionAlerts,
      quickActions,
      recentActivity,
    };
  }

  // ─── Sales dashboard ───────────────────────────────────────────────

  async salesDashboardMetrics() {
    const salesDashboard = await import('./salesDashboardApi');
    return salesDashboard.fetchSalesDashboardMetrics(this.sb);
  }

  async listSalesRegister(opts?: {
    fromIso?: string | null;
    toIso?: string | null;
    search?: string;
    limit?: number;
  }) {
    const salesDashboard = await import('./salesDashboardApi');
    return salesDashboard.listSalesRegister(this.sb, opts);
  }

  async resolveSaleToOrderId(saleOrOrderId: string) {
    const salesDashboard = await import('./salesDashboardApi');
    return salesDashboard.resolveSaleToOrderId(this.sb, saleOrOrderId);
  }

  // ─── Reports ────────────────────────────────────────────────────────

  async reportsSnapshot(): Promise<ReportsSnapshot> {
    const [salesRes, saleItemsRes, salePaysRes, areasRes, profilesRes, locationsRes, categoriesRes] =
      await Promise.all([
        this.sb
          .from('sales')
          .select('id, order_id, total, subtotal, discount, converted_at, invoice_number, status'),
        this.sb
          .from('sale_items')
          .select('sale_id, product_name, sku_code, sku_name, quantity, line_total'),
        this.sb.from('sales_payments').select('sale_id, status, amount'),
        this.sb.from('service_areas').select('id, name'),
        this.sb
          .from('profiles')
          .select('id, display_name')
          .contains('roles', ['SALESMAN']),
        this.sb.from('operational_locations').select('id, name'),
        this.sb.from('categories').select('id, name').is('deleted_at', null),
      ]);

    if (salesRes.error) {
      throwRpcError(salesRes.error, 'Could not load sales for reports');
    }
    if (saleItemsRes.error) {
      throwRpcError(saleItemsRes.error, 'Could not load sale items for reports');
    }
    if (salePaysRes.error) {
      throwRpcError(salePaysRes.error, 'Could not load sales payments for reports');
    }

    const salesRows = ((salesRes.data ?? []) as Row[])
      .filter((s) => str(s['status']).toUpperCase() !== 'REFUNDED')
      .map((s) => ({
      id: str(s['id']),
      order_id: str(s['order_id']),
      total: num(s['total']),
      converted_at: str(s['converted_at']),
      invoice_number: str(s['invoice_number']) || undefined,
    }));
    const activeSaleIds = new Set(salesRows.map((s) => s.id));
    const saleItemRows = ((saleItemsRes.data ?? []) as Row[])
      .filter((item) => activeSaleIds.has(str(item['sale_id'])))
      .map((item) => ({
      sale_id: str(item['sale_id']),
      product_name: str(item['product_name']) || null,
      sku_code: str(item['sku_code']) || null,
      sku_name: str(item['sku_name']) || null,
      quantity: num(item['quantity']),
      line_total: num(item['line_total']),
    }));
    const salePayRows = ((salePaysRes.data ?? []) as Row[])
      .filter((p) => activeSaleIds.has(str(p['sale_id'])))
      .map((p) => ({
      sale_id: str(p['sale_id']),
      status: str(p['status']),
      amount: num(p['amount']),
    }));

    const kpis = buildSalesReportKpis({
      sales: salesRows,
      payments: salePayRows,
    });

    const revenueSeries = buildRevenueByDayFromSales(salesRows, 7);
    const hasRecentRevenue = revenueSeries.some((p) => p.value > 0);
    const topProducts = buildTopProductsFromSaleItems(saleItemRows, 10);

    const orderIds = [...new Set(salesRows.map((s) => s.order_id).filter(Boolean))];
    const orderSalesmanByOrderId = new Map<string, string>();
    if (orderIds.length > 0) {
      const { data: orderRows, error: ordersErr } = await this.sb
        .from('orders')
        .select('id, created_by_profile_id')
        .in('id', orderIds);
      if (ordersErr) {
        throwRpcError(ordersErr, 'Could not load orders for salesman report');
      }
      const profileName = new Map(
        ((profilesRes.data ?? []) as Row[]).map((p) => [
          str(p['id']),
          str(p['display_name']) || '—',
        ]),
      );
      // Also load any creator profiles not in SALESMAN role list.
      const creatorIds = [
        ...new Set(
          ((orderRows ?? []) as Row[])
            .map((o) => str(o['created_by_profile_id']))
            .filter(Boolean),
        ),
      ].filter((id) => !profileName.has(id));
      if (creatorIds.length > 0) {
        const { data: extraProfiles, error: extraErr } = await this.sb
          .from('profiles')
          .select('id, display_name')
          .in('id', creatorIds);
        if (extraErr) {
          throwRpcError(extraErr, 'Could not load salesman profiles for reports');
        }
        for (const p of (extraProfiles ?? []) as Row[]) {
          profileName.set(str(p['id']), str(p['display_name']) || '—');
        }
      }
      for (const o of (orderRows ?? []) as Row[]) {
        const oid = str(o['id']);
        const pid = str(o['created_by_profile_id']);
        orderSalesmanByOrderId.set(oid, profileName.get(pid) ?? '—');
      }
    }

    const salesmanBoard = buildSalesmanLeaderboardFromSales({
      sales: salesRows,
      orderSalesmanByOrderId,
    });

    const unavailable = (title: string, question: string, id: string) => ({
      id,
      title,
      question,
      chartKind: 'table' as const,
      columns: ['Status'],
      rows: [],
      unavailable: true,
      emptyDetail:
        'Not available from converted sales records yet. This section has no live sales-backed query.',
    });

    const sections: ReportsSection[] = [
      {
        id: 'sales',
        label: 'Sales',
        intro:
          'Invoiced wholesale from converted sales (sales + sale_items). Open orders are excluded.',
        reports: [
          {
            id: 'revenue_trend',
            title: 'Revenue by Day',
            question: 'How is invoiced revenue trending over the last 7 days?',
            chartKind: 'bar',
            series: hasRecentRevenue ? revenueSeries : [],
            emptyDetail: hasRecentRevenue
              ? undefined
              : salesReportEmptyDetail('revenue'),
          },
          {
            id: 'top_products',
            title: 'Top Products',
            question: 'Which products contribute the most invoiced revenue?',
            chartKind: 'table',
            columns: topProducts.columns,
            rows: topProducts.rows,
            emptyDetail:
              topProducts.rows.length === 0
                ? salesReportEmptyDetail('products')
                : undefined,
          },
        ],
      },
      {
        id: 'products',
        label: 'Products',
        intro: 'Catalogue performance beyond invoiced sale_items is not wired yet.',
        reports: [
          unavailable(
            'Product Performance',
            'Which catalogue products need attention beyond invoiced sales?',
            'product_performance',
          ),
        ],
      },
      {
        id: 'customers',
        label: 'Customers',
        intro: 'Customer acquisition metrics are not derived from sales tables yet.',
        reports: [
          unavailable(
            'Customer Growth',
            'How fast is the retailer network growing?',
            'customer_growth',
          ),
        ],
      },
      {
        id: 'salesmen',
        label: 'Salesmen',
        intro: 'Field productivity from converted sales linked to order creators.',
        reports: [
          {
            id: 'salesman_leaderboard',
            title: 'Salesman Leaderboard',
            question: 'Who are the top performers by invoiced sales?',
            chartKind: 'table',
            columns: salesmanBoard.columns,
            rows: salesmanBoard.rows,
            emptyDetail:
              salesmanBoard.rows.length === 0
                ? salesReportEmptyDetail('salesmen')
                : undefined,
          },
        ],
      },
      {
        id: 'delivery',
        label: 'Delivery',
        intro: 'Delivery efficiency is not computed from sales records.',
        reports: [
          unavailable(
            'Delivery Efficiency',
            'How efficient are delivery routes?',
            'delivery_efficiency',
          ),
        ],
      },
      {
        id: 'inventory',
        label: 'Inventory',
        intro: 'Stock health is not computed from sales records.',
        reports: [
          unavailable(
            'Stock Health',
            'What is the overall inventory health?',
            'stock_health',
          ),
        ],
      },
    ];

    return {
      generatedAtLabel: formatDateTime(new Date().toISOString()),
      kpis,
      filterOptions: {
        dateRanges: [
          { value: 'all', label: 'All Time' },
          { value: '7d', label: 'Last 7 Days' },
          { value: '30d', label: 'Last 30 Days' },
          { value: 'today', label: 'Today' },
        ],
        categories: ((categoriesRes.data ?? []) as Row[]).map((c) => ({
          value: str(c['id']),
          label: str(c['name']),
        })),
        areas: ((areasRes.data ?? []) as Row[]).map((a) => ({
          value: str(a['id']),
          label: str(a['name']),
        })),
        salesmen: ((profilesRes.data ?? []) as Row[]).map((p) => ({
          value: str(p['id']),
          label: str(p['display_name']),
        })),
        warehouses: ((locationsRes.data ?? []) as Row[]).map((l) => ({
          value: str(l['id']),
          label: str(l['name']),
        })),
        customers: [],
      },
      defaultFilters: {
        dateRange: 'all',
        category: 'all',
        area: 'all',
        salesman: 'all',
        warehouse: 'all',
        customer: 'all',
      },
      sections,
    };
  }

  // ─── Settings ───────────────────────────────────────────────────────

  async settingsSnapshot(): Promise<SettingsSnapshot> {
    const { data: settingsRows } = await this.sb
      .from('settings')
      .select('*');

    const settingsMap = new Map<string, unknown>();
    for (const row of (settingsRows ?? []) as Row[]) {
      try {
        settingsMap.set(str(row['setting_key']), typeof row['setting_value'] === 'string' ? JSON.parse(str(row['setting_value'])) : row['setting_value']);
      } catch {
        settingsMap.set(str(row['setting_key']), row['setting_value']);
      }
    }

    const warehouses: WarehouseRow[] = (await this.warehouseList()).map(
      mapWarehouseListItemToSettingsRow,
    );

    const serviceAreas: ServiceAreaRow[] = (await this.serviceAreaList()).map(
      toSettingsServiceArea,
    );

    const companyData = settingsMap.get('company');
    const company = mapCompanySettingsToProfile(companyData);

    const payData = settingsMap.get('payments') as Record<string, unknown> | undefined;
    const paymentsConfig = {
      codEnabled: payData?.['codEnabled'] !== false,
      onlineEnabled: payData?.['onlineEnabled'] === true,
      creditEnabled: payData?.['creditEnabled'] === true,
      gatewayPlaceholderLabel: str(payData?.['gateway'] ?? 'Online payments'),
    };

    const prefData = settingsMap.get('preferences') as Record<string, unknown> | undefined;
    const preferences = {
      currencyLabel: str(prefData?.['currency'] ?? 'INR (₹)'),
      timezoneLabel: str(prefData?.['timezone'] ?? 'Asia/Kolkata'),
      dateFormatLabel: str(prefData?.['dateFormat'] ?? 'DD MMM YYYY'),
      languageLabel: str(prefData?.['language'] ?? 'English'),
    };

    const { data: taxSkus } = await this.sb
      .from('skus')
      .select('id, sku_code, name, hsn_code, gst_rate_percent')
      .is('deleted_at', null)
      .not('hsn_code', 'is', null)
      .limit(200);
    const taxes: TaxConfigRow[] = ((taxSkus ?? []) as unknown as Row[])
      .filter((s) => str(s['hsn_code']).trim().length > 0)
      .map((s) => ({
        id: str(s['id']),
        categoryLabel: `${str(s['sku_code'])} · ${str(s['name'])}`,
        gstPercentLabel:
          s['gst_rate_percent'] != null
            ? `${num(s['gst_rate_percent'])}%`
            : '—',
        hsnCode: str(s['hsn_code']),
      }));

    return {
      generatedAtLabel: formatDateTime(new Date().toISOString()),
      company,
      warehouses,
      serviceAreas,
      deliverySlots: [
        { id: 'morning', name: 'Morning', windowLabel: '6:00 AM – 10:00 AM', kind: 'morning', enabled: true },
        { id: 'afternoon', name: 'Afternoon', windowLabel: '12:00 PM – 4:00 PM', kind: 'afternoon', enabled: true },
        { id: 'evening', name: 'Evening', windowLabel: '5:00 PM – 9:00 PM', kind: 'evening', enabled: false },
      ],
      payments: paymentsConfig,
      notifications: [],
      taxes,
      roles: [],
      preferences,
    };
  }

  // ─── Private helpers ────────────────────────────────────────────────

  private resolvePublishStatus(
    product: Row,
    _activeSkuIds: string[],
    _livePriceMap: Map<string, number>,
    _hasActiveCategory: boolean,
  ): ProductPublishStatus {
    return resolveCataloguePublishStatus({
      isActive: product['is_active'] !== false,
    });
  }
}

function generateInvitationToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
