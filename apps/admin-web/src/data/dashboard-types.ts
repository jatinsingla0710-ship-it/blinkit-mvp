/** View-model types for Admin Dashboard — live Supabase business control center. */

export type KpiTone = 'default' | 'positive' | 'warning' | 'danger';

export type KpiTrendDirection = 'up' | 'down' | 'flat' | 'unknown';

export interface KpiTrend {
  direction: KpiTrendDirection;
  label: string;
}

export type ExecutiveKpiId =
  | 'monthly_revenue'
  | 'pending_orders'
  | 'manager_collections_pending'
  | 'in_transit'
  | 'pending_to_receive'
  | 'driver_collections_pending';

/** Owner dashboard KPI — exactly six cards, each navigates to a live view. */
export interface ExecutiveKpi {
  id: ExecutiveKpiId;
  label: string;
  value: string;
  /** Short supporting line (e.g. "Pending Collection"). */
  hint?: string;
  trend?: KpiTrend;
  tone?: KpiTone;
  href: string;
}

/** Salesman with real attendance start or visit activity today. */
export interface SalesmanWorkingTodayRow {
  profileId: string;
  displayName: string;
  operationalState: string;
  dayStartedAt: string | null;
  dayEndedAt: string | null;
  serviceAreaName: string | null;
  assignedShops: number;
  visitsToday: number;
  ordersToday: number;
  lastVisit: {
    shopName: string;
    visitedAt: string | null;
    status: string;
  } | null;
}

export interface SalesmenWorkingTodaySnapshot {
  asOfDate: string;
  salesmen: SalesmanWorkingTodayRow[];
}

/** Manager-held COD row from admin_manager_cod_custody_breakdown. */
export interface ManagerCodCustodyRow {
  managerProfileId: string;
  managerName: string;
  warehouseId: string;
  warehouseName: string;
  amount: number;
  amountLabel: string;
  handoverCount: number;
  oldestHandoverLabel: string;
  newestHandoverLabel: string;
}

export interface ManagerCodCustodySnapshot {
  totalAmount: number;
  totalLabel: string;
  rows: ManagerCodCustodyRow[];
}

/** Today's operational throughput metrics — each opens Orders with a preset filter. */
export interface OperationsMetric {
  id: string;
  label: string;
  count: number;
  href: string;
}

export type AttentionSeverity = 'high' | 'medium' | 'low';

/** Actionable alert surfaced on the dashboard. */
export interface AttentionAlert {
  id: string;
  title: string;
  count: number;
  severity: AttentionSeverity;
  href: string;
}

export type QuickActionId =
  | 'new_sale'
  | 'new_purchase'
  | 'record_expense'
  | 'collect_payment'
  | 'scan_bill'
  | 'ask_ai';

export interface DashboardQuickAction {
  id: QuickActionId;
  label: string;
  description: string;
  href?: string;
  comingSoon?: boolean;
}

export type BusinessActivityKind =
  | 'order_created'
  | 'order_cancelled'
  | 'stock_updated'
  | 'product_added'
  | 'price_updated'
  | 'delivery_completed'
  | 'customer_registered'
  | 'payment_received'
  | 'payment_pending'
  | 'salesman_check_in';

/** Unified recent business activity feed item. */
export interface BusinessActivityItem {
  id: string;
  kind: BusinessActivityKind;
  title: string;
  detail: string;
  actorLabel?: string;
  timestampLabel: string;
  /** ISO timestamp for sorting (not shown in UI). */
  occurredAt: string;
  href: string;
}

export interface DashboardSnapshot {
  generatedAtLabel: string;
  executiveKpis: ExecutiveKpi[];
  operations: OperationsMetric[];
  attentionAlerts: AttentionAlert[];
  quickActions: DashboardQuickAction[];
  recentActivity: BusinessActivityItem[];
}

export interface NavItem {
  id: string;
  label: string;
  path: string;
  /** Additional path prefixes that keep this nav item highlighted. */
  matchPrefixes?: string[];
  /** Prefixes that must not activate this item (e.g. commission under pricing). */
  excludePrefixes?: string[];
}

export interface NavGroup {
  id: string;
  /** Section heading; null = no group label. */
  label: string | null;
  items: NavItem[];
}

/** @deprecated Legacy KPI shape — used by Orders/Inventory module KPI strips only. */
export interface DashboardKpi {
  id: string;
  label: string;
  value: string;
  hint?: string;
  tone?: KpiTone;
}

/** @deprecated Legacy dashboard widgets — no longer rendered on DashboardPage. */
export interface DailyFocusItem {
  id: string;
  title: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
}

/** @deprecated Legacy dashboard widgets — no longer rendered on DashboardPage. */
export interface LowStockItem {
  id: string;
  skuName: string;
  skuCode: string;
  available: number;
  unit: string;
  threshold: number;
}

/** @deprecated Legacy dashboard widgets — no longer rendered on DashboardPage. */
export type OrderStatusLabel =
  | 'Draft'
  | 'Confirmed'
  | 'Processing'
  | 'Packing'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled'
  | 'Failed'
  | 'Other';

/** @deprecated Legacy dashboard widgets — no longer rendered on DashboardPage. */
export interface RecentOrderRow {
  id: string;
  orderCode: string;
  shopName: string;
  amountLabel: string;
  status: OrderStatusLabel;
  placedAtLabel: string;
}

/** @deprecated Legacy dashboard widgets — no longer rendered on DashboardPage. */
export interface SalesmanPerformanceRow {
  id: string;
  name: string;
  ordersToday: number;
  revenueLabel: string;
  collectionsLabel: string;
  status: 'active' | 'idle';
}

/** @deprecated Use DashboardQuickAction instead. */
export type QuickAction = DashboardQuickAction;
