/**
 * Orders Management — wholesale operations view models.
 * Timeline states align with customer Order Timeline v1.
 */

export type WholesaleFulfillmentStatus =
  | 'CONFIRMED'
  | 'STOCK_RESERVED'
  | 'PACKING'
  | 'READY_FOR_DISPATCH'
  | 'ASSIGNED_TO_ROUTE'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'DELIVERY_FAILED';

/** Maps public.payment_status — PARTIAL is UI-only legacy; live path never emits it. */
export type PaymentStatusVm = 'PAID' | 'UNPAID' | 'PENDING' | 'PARTIAL' | 'REFUNDED';

export type DeliveryStatusVm =
  | 'not_started'
  | 'assigned'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed';

export interface OrdersDashboardKpi {
  id: string;
  label: string;
  value: string;
  hint?: string;
  /** Secondary line under the count (e.g. "5 orders require action"). */
  subtitle?: string;
  /** Short breakdown bullets for Needs Attention card. */
  bullets?: string[];
  tone?: 'default' | 'positive' | 'warning' | 'danger';
  /** Click navigates to this filtered orders view. */
  href?: string;
}

export interface OrdersFilterState {
  search: string;
  date: string;
  status: string;
  payment: string;
  salesman: string;
  warehouse: string;
}

export type OrdersSortId =
  | 'placed_desc'
  | 'placed_asc'
  | 'amount_desc'
  | 'amount_asc'
  | 'customer_asc';

export interface OrderListRow {
  id: string;
  orderCode: string;
  customerName: string;
  customerMobile?: string;
  orderValueLabel: string;
  /** Raw amount for sorting / pending payment totals. */
  orderValueAmount?: number;
  paymentStatus: PaymentStatusVm;
  fulfillmentStatus: WholesaleFulfillmentStatus;
  deliveryStatus: DeliveryStatusVm;
  salesmanName: string;
  salesmanMobile?: string;
  warehouseName: string;
  updatedAtLabel: string;
  placedAtLabel: string;
  placedAtIso: string;
  updatedAtIso: string;
  /** Set when this order has been converted to a sale. */
  saleId?: string;
  saleInvoiceNumber?: string;
  /** sales.converted_at — invoice / conversion time (not order placed_at). */
  saleConvertedAtLabel?: string;
  saleConvertedAtIso?: string;
  /** Pre-sale invoice on the order (before convert). */
  invoiceNumber?: string;
  /** Raw DB order_status for workflow presets (approval, processing). */
  dbStatus?: string;
  deliveryPersonId?: string;
  deliveryPersonName?: string;
  /** True when ops should review (from admin_orders_needing_attention). */
  needsAttention?: boolean;
  attentionReason?: string;
  attentionDescription?: string;
  attentionCategory?: 'delivery' | 'payment' | 'sale' | 'exception';
  attentionSeverity?: 'critical' | 'action_required' | 'review';
  suggestedAction?: string;
}

export interface OrderLineItem {
  id: string;
  /** Required for admin_replace_order_lines when editing. */
  skuId?: string;
  productName?: string;
  skuCode: string;
  skuName: string;
  quantityLabel: string;
  unitPriceLabel: string;
  discountLabel?: string;
  lineTotalLabel: string;
  quantity?: number;
  unitPrice?: number;
  lineTotal?: number;
}

/** Row from admin_orders_needing_attention. */
export interface OrderNeedingAttention {
  orderId: string;
  status: string;
  total: number;
  updatedAt: string;
  shopName: string;
  reasonCode: string;
  priority: number;
  severity?: string;
  attentionDetail?: string;
}

export interface OrdersNeedingAttentionResult {
  orders: OrderNeedingAttention[];
  count: number;
  summary: { reasonCode: string; count: number }[];
}

export type OrderWorkflowStageId =
  | 'ORDER_CREATED'
  | 'CONFIRMED'
  | 'INVOICE_CREATED'
  | 'PACKING'
  | 'READY_FOR_DISPATCH'
  | 'ASSIGNED_TO_ROUTE'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'PAYMENT_RECEIVED'
  | 'SALE_COMPLETED';

export interface OrderTimelineStage {
  status: OrderWorkflowStageId | WholesaleFulfillmentStatus;
  label: string;
  explanation: string;
  state: 'done' | 'current' | 'upcoming';
  /** Highlight current stage when ops attention is required. */
  attention?: boolean;
  at?: string;
  actorLabel?: string;
}

export interface OrderPaymentSummary {
  methodLabel: string;
  status: PaymentStatusVm;
  subtotalLabel: string;
  discountLabel?: string;
  adjustmentsLabel: string;
  totalLabel: string;
  collectedLabel: string;
  outstandingLabel: string;
  subtotal?: number;
  discount?: number;
  total?: number;
  collected?: number;
  outstanding?: number;
}

export interface OrderDeliverySummary {
  addressLabel: string;
  addressText: string;
  windowLabel: string;
  routeLabel?: string;
  routeId?: string;
  warehouseName: string;
  deliveryStatus: DeliveryStatusVm;
  deliveryPersonId?: string;
  deliveryPersonName?: string;
  serviceAreaId?: string;
  serviceAreaName?: string;
  challanLabel?: string;
  /** H5 enrichments */
  scheduledDate?: string | null;
  timeSlotLabel?: string | null;
  vehicleLabel?: string | null;
  vehicleId?: string | null;
  progressLabel?: string | null;
  codCustodyStatus?: string | null;
  codCustodyLabel?: string | null;
  notificationHonesty?: string | null;
}

export interface OrderActivityRow {
  id: string;
  atLabel: string;
  actorLabel: string;
  actionLabel: string;
  detail: string;
  occurredAt?: string;
}

export interface DeliveryStaffOption {
  id: string;
  name: string;
  mobileLabel?: string;
}

export interface OrderDetail {
  id: string;
  orderCode: string;
  customerName: string;
  shopName?: string;
  customerMobile?: string;
  deliveryAddress?: string;
  salesmanName: string;
  salesmanMobile?: string;
  salesmanEmployeeCode?: string;
  warehouseName: string;
  serviceAreaName?: string;
  placedAtLabel: string;
  placedDateLabel?: string;
  placedTimeLabel?: string;
  updatedAtLabel: string;
  notes?: string;
  /** Raw DB order_status — used for smart next-action (e.g. confirm pending). */
  dbStatus?: string;
  fulfillmentStatus: WholesaleFulfillmentStatus;
  paymentStatus: PaymentStatusVm;
  deliveryStatus: DeliveryStatusVm;
  orderValueLabel: string;
  invoicePrinted?: boolean;
  /** Pre-sale invoice document number (orders.invoice_number). */
  invoiceNumber?: string;
  invoiceCreatedAt?: string;
  invoiceCreatedAtLabel?: string;
  /** Exception / attention from order_events or unassigned ready. */
  needsAttention?: boolean;
  attentionReason?: string;
  lines: OrderLineItem[];
  timeline: OrderTimelineStage[];
  /** Full chronological workflow events for the activity-style timeline. */
  workflowEvents?: OrderActivityRow[];
  payment: OrderPaymentSummary;
  delivery: OrderDeliverySummary;
  activity: OrderActivityRow[];
  availableDeliveryStaff?: DeliveryStaffOption[];
  /** Present after Convert to Sale — amounts from sales / sales_payments. */
  sale?: {
    id: string;
    invoiceNumber: string;
    convertedAtLabel: string;
    subtotal?: number;
    discount?: number;
    total?: number;
    currency?: string;
    paymentStatus?: PaymentStatusVm;
    paymentAmount?: number;
    collectedAtLabel?: string;
  };
  company?: {
    companyName: string;
    sellerName?: string;
    email: string;
    phoneLabel: string;
    businessAddress: string;
    logoUrl?: string;
    gstNumber?: string;
    pan?: string;
  };
}

export type InvoicePrintSize = 'a4' | 'a5' | 'a6' | 'thermal';

export interface OrdersSnapshot {
  generatedAtLabel: string;
  kpis: OrdersDashboardKpi[];
  rows: OrderListRow[];
  /** Converted sales (order rows that have a sale record). */
  salesRows: OrderListRow[];
  filterOptions: {
    statuses: { value: string; label: string }[];
    payments: { value: string; label: string }[];
    salesmen: { value: string; label: string }[];
    warehouses: { value: string; label: string }[];
  };
}
