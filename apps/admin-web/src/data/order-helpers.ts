import type {
  OrderTimelineStage,
  WholesaleFulfillmentStatus,
  OrdersFilterState,
  OrderListRow,
  OrdersSortId,
  OrderActivityRow,
  PaymentStatusVm,
  OrderWorkflowStageId,
} from '@/data/orders-types';

const TIMELINE_DEFS: {
  status: OrderWorkflowStageId;
  label: string;
  explanation: string;
}[] = [
  {
    status: 'ORDER_CREATED',
    label: 'Order Received',
    explanation: 'Order placed in the system.',
  },
  {
    status: 'CONFIRMED',
    label: 'Confirmed',
    explanation: 'Order approved and ready for fulfilment.',
  },
  {
    status: 'INVOICE_CREATED',
    label: 'Invoice Created',
    explanation: 'Pre-sale invoice number assigned.',
  },
  {
    status: 'PACKING',
    label: 'Packing',
    explanation: 'Warehouse is picking and packing items.',
  },
  {
    status: 'READY_FOR_DISPATCH',
    label: 'Ready for Dispatch',
    explanation: 'Packed and waiting for delivery assignment.',
  },
  {
    status: 'ASSIGNED_TO_ROUTE',
    label: 'Delivery Assigned',
    explanation: 'Scheduled on a delivery route.',
  },
  {
    status: 'OUT_FOR_DELIVERY',
    label: 'Out for Delivery',
    explanation: 'On the delivery vehicle to the shop.',
  },
  {
    status: 'DELIVERED',
    label: 'Delivered',
    explanation: 'Delivery confirmed with the retailer.',
  },
  {
    status: 'PAYMENT_RECEIVED',
    label: 'Payment Received',
    explanation: 'Payment collected and marked paid.',
  },
  {
    status: 'SALE_COMPLETED',
    label: 'Sale Completed',
    explanation: 'Order converted to a completed sale invoice.',
  },
];

function resolveTimelineActiveIndex(
  fulfillment: WholesaleFulfillmentStatus,
  options: {
    paymentPaid: boolean;
    saleCompleted: boolean;
    hasInvoice: boolean;
  },
): number {
  if (options.saleCompleted) {
    return TIMELINE_DEFS.findIndex((s) => s.status === 'SALE_COMPLETED');
  }
  if (options.paymentPaid && fulfillment === 'DELIVERED') {
    return TIMELINE_DEFS.findIndex((s) => s.status === 'PAYMENT_RECEIVED');
  }
  if (fulfillment === 'DELIVERED') {
    return TIMELINE_DEFS.findIndex((s) => s.status === 'DELIVERED');
  }
  if (fulfillment === 'OUT_FOR_DELIVERY') {
    return TIMELINE_DEFS.findIndex((s) => s.status === 'OUT_FOR_DELIVERY');
  }
  if (fulfillment === 'ASSIGNED_TO_ROUTE') {
    return TIMELINE_DEFS.findIndex((s) => s.status === 'ASSIGNED_TO_ROUTE');
  }
  if (fulfillment === 'READY_FOR_DISPATCH') {
    return TIMELINE_DEFS.findIndex((s) => s.status === 'READY_FOR_DISPATCH');
  }
  if (fulfillment === 'PACKING') {
    return TIMELINE_DEFS.findIndex((s) => s.status === 'PACKING');
  }
  if (fulfillment === 'CONFIRMED' || fulfillment === 'STOCK_RESERVED') {
    return options.hasInvoice
      ? TIMELINE_DEFS.findIndex((s) => s.status === 'PACKING')
      : TIMELINE_DEFS.findIndex((s) => s.status === 'CONFIRMED');
  }
  if (fulfillment === 'CANCELLED' || fulfillment === 'DELIVERY_FAILED') {
    return TIMELINE_DEFS.findIndex((s) => s.status === 'ORDER_CREATED');
  }
  return TIMELINE_DEFS.findIndex((s) => s.status === 'CONFIRMED');
}

export function buildOrderTimeline(
  current: WholesaleFulfillmentStatus,
  stamps: Partial<Record<WholesaleFulfillmentStatus, string>>,
  actors?: Partial<Record<WholesaleFulfillmentStatus, string>>,
  extras?: {
    paymentPaid?: boolean;
    saleCompleted?: boolean;
    paymentAt?: string;
    saleAt?: string;
    paymentActor?: string;
    saleActor?: string;
    createdAt?: string;
    createdActor?: string;
    invoiceCreatedAt?: string;
    invoiceCreatedActor?: string;
    hasInvoice?: boolean;
    needsAttention?: boolean;
  },
): OrderTimelineStage[] {
  const paymentPaid = Boolean(extras?.paymentPaid);
  const saleCompleted = Boolean(extras?.saleCompleted);
  const hasInvoice = Boolean(extras?.hasInvoice ?? extras?.invoiceCreatedAt);
  const activeIndex = resolveTimelineActiveIndex(current, {
    paymentPaid,
    saleCompleted,
    hasInvoice,
  });
  const attentionAtIndex =
    extras?.needsAttention &&
    (current === 'READY_FOR_DISPATCH' ||
      current === 'DELIVERED' ||
      current === 'ASSIGNED_TO_ROUTE')
      ? activeIndex
      : -1;

  const workflowStamps: Partial<Record<OrderWorkflowStageId, string>> = {
    ORDER_CREATED: extras?.createdAt ?? stamps.CONFIRMED,
    CONFIRMED: stamps.CONFIRMED ?? stamps.STOCK_RESERVED,
    INVOICE_CREATED: extras?.invoiceCreatedAt,
    PACKING: stamps.PACKING,
    READY_FOR_DISPATCH: stamps.READY_FOR_DISPATCH,
    ASSIGNED_TO_ROUTE: stamps.ASSIGNED_TO_ROUTE,
    OUT_FOR_DELIVERY: stamps.OUT_FOR_DELIVERY,
    DELIVERED: stamps.DELIVERED,
    PAYMENT_RECEIVED: extras?.paymentAt,
    SALE_COMPLETED: extras?.saleAt,
  };
  const workflowActors: Partial<Record<OrderWorkflowStageId, string>> = {
    ORDER_CREATED: extras?.createdActor ?? actors?.CONFIRMED,
    CONFIRMED: actors?.CONFIRMED ?? actors?.STOCK_RESERVED,
    INVOICE_CREATED: extras?.invoiceCreatedActor,
    PACKING: actors?.PACKING,
    READY_FOR_DISPATCH: actors?.READY_FOR_DISPATCH,
    ASSIGNED_TO_ROUTE: actors?.ASSIGNED_TO_ROUTE,
    OUT_FOR_DELIVERY: actors?.OUT_FOR_DELIVERY,
    DELIVERED: actors?.DELIVERED,
    PAYMENT_RECEIVED: extras?.paymentActor,
    SALE_COMPLETED: extras?.saleActor,
  };

  return TIMELINE_DEFS.map((stage, index) => {
    let state: OrderTimelineStage['state'] = 'upcoming';
    if (stage.status === 'INVOICE_CREATED') {
      state = hasInvoice ? 'done' : 'upcoming';
      if (
        hasInvoice &&
        activeIndex === TIMELINE_DEFS.findIndex((s) => s.status === 'PACKING') &&
        index === TIMELINE_DEFS.findIndex((s) => s.status === 'INVOICE_CREATED')
      ) {
        state = 'done';
      }
    } else if (activeIndex >= 0 && index < activeIndex) {
      state = 'done';
    } else if (activeIndex >= 0 && index === activeIndex) {
      state = index === attentionAtIndex ? 'current' : 'current';
    }
    if (
      saleCompleted &&
      stage.status !== 'INVOICE_CREATED' &&
      index <= activeIndex
    ) {
      state = index === activeIndex ? 'current' : 'done';
    }
    return {
      status: stage.status,
      label: stage.label,
      explanation: stage.explanation,
      state,
      attention: index === attentionAtIndex,
      at: workflowStamps[stage.status],
      actorLabel: workflowActors[stage.status],
    };
  });
}

/** Build chronological workflow events from activity (includes invoice / payment notes). */
export function buildWorkflowEvents(
  activity: OrderActivityRow[],
): OrderActivityRow[] {
  return [...activity].sort((a, b) =>
    (a.occurredAt ?? '').localeCompare(b.occurredAt ?? ''),
  );
}

export const EMPTY_ORDERS_FILTERS: OrdersFilterState = {
  search: '',
  date: '',
  status: 'all',
  payment: 'all',
  salesman: 'all',
  warehouse: 'all',
};

export type OrdersListPreset =
  | 'active'
  | 'awaiting_approval'
  | 'processing'
  | 'ready_dispatch'
  | 'needs_attention'
  | 'new_today'
  | 'pending'
  | 'packed'
  | 'in_transit'
  | 'paid_completed'
  | 'unpaid'
  | 'out_for_delivery'
  | 'delivered_today'
  | 'sales';

const PRESET_PENDING: WholesaleFulfillmentStatus[] = [
  'CONFIRMED',
  'STOCK_RESERVED',
  'PACKING',
];

const PRESET_PACKED: WholesaleFulfillmentStatus[] = ['READY_FOR_DISPATCH'];

const PRESET_IN_TRANSIT: WholesaleFulfillmentStatus[] = [
  'ASSIGNED_TO_ROUTE',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

const PRESET_SALES: WholesaleFulfillmentStatus[] = [
  'ASSIGNED_TO_ROUTE',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

export function parseOrdersListPreset(
  value: string | null,
): OrdersListPreset | undefined {
  if (
    value === 'active' ||
    value === 'awaiting_approval' ||
    value === 'processing' ||
    value === 'ready_dispatch' ||
    value === 'needs_attention' ||
    value === 'new_today' ||
    value === 'pending' ||
    value === 'packed' ||
    value === 'in_transit' ||
    value === 'paid_completed' ||
    value === 'unpaid' ||
    value === 'out_for_delivery' ||
    value === 'delivered_today' ||
    value === 'sales'
  ) {
    return value;
  }
  return undefined;
}

function isSameCalendarDay(iso: string, ref = new Date()): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function rowMatchesDate(row: OrderListRow, dateYmd: string): boolean {
  if (!dateYmd) return true;
  const prefix = dateYmd.slice(0, 10);
  return row.placedAtIso.startsWith(prefix);
}

export function applyOrdersListPreset(
  rows: readonly OrderListRow[],
  preset: OrdersListPreset,
  options?: { attentionOrderIds?: ReadonlySet<string> },
): OrderListRow[] {
  switch (preset) {
    case 'active':
      return rows.filter(
        (row) =>
          row.fulfillmentStatus !== 'CANCELLED' &&
          row.fulfillmentStatus !== 'DELIVERY_FAILED' &&
          !row.saleId,
      );
    case 'awaiting_approval':
      return rows.filter(
        (row) =>
          row.dbStatus === 'DRAFT_ASSISTED' ||
          row.dbStatus === 'AWAITING_CUSTOMER_CONFIRMATION',
      );
    case 'processing':
      return rows.filter(
        (row) =>
          row.dbStatus === 'PROCESSING' ||
          row.fulfillmentStatus === 'PACKING' ||
          row.fulfillmentStatus === 'STOCK_RESERVED' ||
          (row.fulfillmentStatus === 'CONFIRMED' &&
            row.dbStatus !== 'DRAFT_ASSISTED' &&
            row.dbStatus !== 'AWAITING_CUSTOMER_CONFIRMATION'),
      );
    case 'ready_dispatch':
      return rows.filter(
        (row) => row.fulfillmentStatus === 'READY_FOR_DISPATCH',
      );
    case 'needs_attention':
      if (options?.attentionOrderIds && options.attentionOrderIds.size > 0) {
        return rows.filter((row) => options.attentionOrderIds!.has(row.id));
      }
      return rows.filter((row) => Boolean(row.needsAttention));
    case 'new_today':
      return rows.filter((row) => isSameCalendarDay(row.placedAtIso));
    case 'pending':
      return rows.filter((row) =>
        PRESET_PENDING.includes(row.fulfillmentStatus),
      );
    case 'packed':
      return rows.filter((row) => PRESET_PACKED.includes(row.fulfillmentStatus));
    case 'in_transit':
      return rows.filter((row) =>
        PRESET_IN_TRANSIT.includes(row.fulfillmentStatus),
      );
    case 'sales':
      return rows.filter((row) => PRESET_SALES.includes(row.fulfillmentStatus));
    case 'paid_completed':
      return rows.filter(
        (row) =>
          row.fulfillmentStatus === 'DELIVERED' && row.paymentStatus === 'PAID',
      );
    case 'unpaid':
      return rows.filter((row) => row.paymentStatus !== 'PAID');
    case 'out_for_delivery':
      return rows.filter((row) => row.fulfillmentStatus === 'OUT_FOR_DELIVERY');
    case 'delivered_today':
      return rows.filter(
        (row) =>
          row.fulfillmentStatus === 'DELIVERED' &&
          isSameCalendarDay(row.updatedAtIso),
      );
    default:
      return [...rows];
  }
}

export function filterOrderRows(
  rows: readonly OrderListRow[],
  filters: OrdersFilterState,
  options?: { preset?: OrdersListPreset; attentionOrderIds?: ReadonlySet<string> },
): OrderListRow[] {
  const q = filters.search.trim().toLowerCase();
  let next = rows.filter((row) => {
    if (q) {
      const hay = [
        row.orderCode,
        row.customerName,
        row.customerMobile ?? '',
        row.salesmanName,
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.status !== 'all' && row.fulfillmentStatus !== filters.status) {
      return false;
    }
    if (filters.payment !== 'all' && row.paymentStatus !== filters.payment) {
      return false;
    }
    if (filters.salesman !== 'all' && row.salesmanName !== filters.salesman) {
      return false;
    }
    if (filters.warehouse !== 'all' && row.warehouseName !== filters.warehouse) {
      return false;
    }
    if (filters.date && !rowMatchesDate(row, filters.date)) {
      return false;
    }
    return true;
  });
  if (options?.preset) {
    next = applyOrdersListPreset(next, options.preset, {
      attentionOrderIds: options.attentionOrderIds,
    });
  }
  return next;
}

export function sortOrderRows(
  rows: readonly OrderListRow[],
  sort: OrdersSortId,
): OrderListRow[] {
  const next = [...rows];
  switch (sort) {
    case 'placed_asc':
      return next.sort((a, b) => a.placedAtIso.localeCompare(b.placedAtIso));
    case 'amount_desc':
      return next.sort(
        (a, b) => (b.orderValueAmount ?? 0) - (a.orderValueAmount ?? 0),
      );
    case 'amount_asc':
      return next.sort(
        (a, b) => (a.orderValueAmount ?? 0) - (b.orderValueAmount ?? 0),
      );
    case 'customer_asc':
      return next.sort((a, b) => a.customerName.localeCompare(b.customerName));
    case 'placed_desc':
    default:
      return next.sort((a, b) => b.placedAtIso.localeCompare(a.placedAtIso));
  }
}

export function paginateRows<T>(
  rows: readonly T[],
  page: number,
  pageSize: number,
): { rows: T[]; page: number; pageCount: number; total: number } {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize) as T[],
    page: safePage,
    pageCount,
    total,
  };
}

export function fulfillmentStatusLabel(
  status: WholesaleFulfillmentStatus,
): string {
  switch (status) {
    case 'CONFIRMED':
      return 'Confirmed';
    case 'STOCK_RESERVED':
      return 'Stock Reserved';
    case 'PACKING':
      return 'Packing';
    case 'READY_FOR_DISPATCH':
      return 'Ready for Dispatch';
    case 'ASSIGNED_TO_ROUTE':
      return 'Delivery Assigned';
    case 'OUT_FOR_DELIVERY':
      return 'Out For Delivery';
    case 'DELIVERED':
      return 'Delivered';
    case 'CANCELLED':
      return 'Cancelled';
    case 'DELIVERY_FAILED':
      return 'Delivery Failed';
    default:
      return status;
  }
}

/** Map DB order_status → admin fulfillment VM. */
export function mapDbOrderStatusToFulfillment(
  status: string,
): WholesaleFulfillmentStatus {
  switch (status) {
    case 'PROCESSING':
      return 'PACKING';
    case 'DRAFT_ASSISTED':
    case 'AWAITING_CUSTOMER_CONFIRMATION':
      return 'CONFIRMED';
    case 'CONFIRMED':
      return 'CONFIRMED';
    case 'STOCK_RESERVED':
      return 'STOCK_RESERVED';
    case 'READY_FOR_DISPATCH':
      return 'READY_FOR_DISPATCH';
    case 'ASSIGNED_TO_ROUTE':
      return 'ASSIGNED_TO_ROUTE';
    case 'OUT_FOR_DELIVERY':
      return 'OUT_FOR_DELIVERY';
    case 'DELIVERED':
      return 'DELIVERED';
    case 'DELIVERY_FAILED':
      return 'DELIVERY_FAILED';
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'CONFIRMED';
  }
}

export function ordersPresetHref(preset: OrdersListPreset): string {
  return `/orders?preset=${encodeURIComponent(preset)}`;
}

export function defaultInvoiceFilename(order: {
  orderCode: string;
  customerName?: string;
  invoiceNumber?: string;
  sale?: { invoiceNumber?: string };
}): string {
  const base =
    order.sale?.invoiceNumber?.replace(/[^a-zA-Z0-9-]+/g, '') ||
    order.invoiceNumber?.replace(/[^a-zA-Z0-9-]+/g, '') ||
    (() => {
      const customer = (order.customerName ?? 'Invoice')
        .replace(/[^a-zA-Z0-9]+/g, '')
        .slice(0, 24);
      return `${customer || 'Invoice'}-${order.orderCode}`;
    })();
  return `${base}.pdf`;
}

/**
 * Invoice document date: sale conversion when present, otherwise invoice
 * created / order placed date.
 */
export function invoiceDocumentDateLabel(order: {
  placedDateLabel?: string;
  placedAtLabel: string;
  invoiceCreatedAtLabel?: string;
  sale?: { convertedAtLabel: string } | null;
}): string {
  return (
    order.sale?.convertedAtLabel ||
    order.invoiceCreatedAtLabel ||
    order.placedDateLabel ||
    order.placedAtLabel
  );
}

/** Sales Register → Sales module sale bill (optional print-preview). */
export function salesInvoiceHref(
  orderId: string,
  options?: { preview?: boolean },
): string {
  const qs = new URLSearchParams();
  if (options?.preview) qs.set('preview', '1');
  const q = qs.toString();
  return q ? `/sales/${orderId}?${q}` : `/sales/${orderId}`;
}

/** Sales register row → sale detail by sale UUID. */
export function saleDetailHref(saleId: string, options?: { preview?: boolean }): string {
  const qs = new URLSearchParams();
  if (options?.preview) qs.set('preview', '1');
  const q = qs.toString();
  return q ? `/sales/${saleId}?${q}` : `/sales/${saleId}`;
}

/** Delivered + paid orders may convert once. */
export function canConvertOrderToSale(input: {
  fulfillmentStatus: WholesaleFulfillmentStatus;
  paymentStatus: PaymentStatusVm;
  saleId?: string;
}): boolean {
  if (input.saleId) return false;
  if (input.paymentStatus === 'REFUNDED') return false;
  return (
    input.fulfillmentStatus === 'DELIVERED' && input.paymentStatus === 'PAID'
  );
}

/**
 * Full-order return/refund (Sales H3) — PAID delivered/converted sales only.
 * Partial line returns are not supported without new tables.
 */
export function canRefundConvertedSale(input: {
  fulfillmentStatus: WholesaleFulfillmentStatus;
  paymentStatus: PaymentStatusVm;
  saleId?: string | null;
}): boolean {
  if (input.paymentStatus === 'REFUNDED') return false;
  if (input.paymentStatus !== 'PAID') return false;
  return (
    Boolean(input.saleId) || input.fulfillmentStatus === 'DELIVERED'
  );
}

/**
 * Admin may cancel when not delivered/converted/already cancelled.
 * Matches admin_cancel_order allowed statuses (incl. OFD / delivery failed).
 */
export function canCancelOrder(order: {
  dbStatus?: string;
  fulfillmentStatus: WholesaleFulfillmentStatus;
  saleId?: string | null;
}): boolean {
  if (order.saleId) return false;
  const db = order.dbStatus ?? '';
  if (db === 'CANCELLED' || db === 'DELIVERED') return false;
  if (
    order.fulfillmentStatus === 'CANCELLED' ||
    order.fulfillmentStatus === 'DELIVERED'
  ) {
    return false;
  }
  return true;
}

/**
 * Trusted line edits allowed until packing starts (happy-path index < PROCESSING=4).
 */
export function canEditOrderLines(
  dbStatus: string | undefined,
  saleId?: string | null,
): boolean {
  if (saleId) return false;
  const db = dbStatus ?? '';
  return (
    db === 'DRAFT_ASSISTED' ||
    db === 'AWAITING_CUSTOMER_CONFIRMATION' ||
    db === 'CONFIRMED' ||
    db === 'STOCK_RESERVED'
  );
}

/** True when activity / event notes include a NEEDS_ATTENTION flag. */
export function orderNeedsAttentionFromEvents(
  notes: ReadonlyArray<string | { detail?: string; actionLabel?: string }>,
): boolean {
  return notes.some((n) => {
    const text =
      typeof n === 'string'
        ? n
        : `${n.detail ?? ''} ${n.actionLabel ?? ''}`;
    return /NEEDS_ATTENTION/i.test(text);
  });
}

export type OrderNextActionId =
  | 'confirm_order'
  | 'process_order'
  | 'pack_order'
  | 'assign_delivery'
  | 'assignment_pending'
  | 'waiting_driver'
  | 'waiting_delivery'
  | 'receive_payment'
  | 'convert_to_sale'
  | 'completed'
  | 'none';

export type OrderNextActionKind = 'action' | 'waiting' | 'done';

export type OrderNextAction = {
  id: OrderNextActionId;
  label: string;
  hint: string;
  kind: OrderNextActionKind;
  tab?:
    | 'overview'
    | 'items'
    | 'timeline'
    | 'payment'
    | 'delivery'
    | 'invoice'
    | 'activity';
};

export type OrderBusinessStageKind =
  | 'action'
  | 'waiting'
  | 'attention'
  | 'done'
  | 'blocked';

export type OrderBusinessStage = {
  label: string;
  hint: string;
  kind: OrderBusinessStageKind;
};

/** Human-readable business stage for the order detail header / action panel. */
export function getOrderBusinessStage(order: {
  dbStatus?: string;
  fulfillmentStatus: WholesaleFulfillmentStatus;
  paymentStatus: PaymentStatusVm;
  saleId?: string;
  invoiceNumber?: string | null;
  deliveryPersonName?: string;
  needsAttention?: boolean;
  attentionReason?: string;
}): OrderBusinessStage {
  const db = order.dbStatus ?? '';
  const status = order.fulfillmentStatus;
  const driver = order.deliveryPersonName?.trim();

  if (order.saleId) {
    return {
      label: 'Sale completed',
      hint: 'No further workflow actions required.',
      kind: 'done',
    };
  }
  if (
    db === 'CANCELLED' ||
    db === 'DELIVERY_FAILED' ||
    status === 'CANCELLED' ||
    status === 'DELIVERY_FAILED'
  ) {
    return {
      label: 'Closed',
      hint: 'This order is cancelled or failed.',
      kind: 'blocked',
    };
  }
  if (
    db === 'DRAFT_ASSISTED' ||
    db === 'AWAITING_CUSTOMER_CONFIRMATION'
  ) {
    return {
      label: 'Awaiting approval',
      hint: 'Review the order and approve to begin fulfilment.',
      kind: 'action',
    };
  }
  if (status === 'DELIVERED' && order.paymentStatus === 'PAID') {
    return {
      label: 'Delivered · paid',
      hint: 'Sale conversion is usually automatic.',
      kind: 'action',
    };
  }
  if (status === 'DELIVERED') {
    return {
      label: 'Delivered · payment pending',
      hint: 'Record payment to unlock sale conversion.',
      kind: 'action',
    };
  }
  if (status === 'OUT_FOR_DELIVERY') {
    return {
      label: driver ? `Out for delivery · ${driver}` : 'Out for delivery',
      hint: 'Waiting for delivery confirmation in the Delivery PWA.',
      kind: 'waiting',
    };
  }
  if (status === 'ASSIGNED_TO_ROUTE') {
    return {
      label: driver ? `Assigned to ${driver}` : 'Delivery assigned',
      hint: 'Driver will start the route from the Delivery PWA.',
      kind: 'waiting',
    };
  }
  if (status === 'READY_FOR_DISPATCH') {
    if (!driver || order.needsAttention) {
      return {
        label: 'Packed · assignment needs attention',
        hint:
          order.attentionReason ??
          'Schedule delivery manually from the Delivery tab.',
        kind: 'attention',
      };
    }
    return {
      label: `Assigned to ${driver}`,
      hint: 'Packed and scheduled. Waiting for the driver to start.',
      kind: 'waiting',
    };
  }
  if (status === 'PACKING' || db === 'PROCESSING') {
    return {
      label: 'Ready to pack',
      hint: 'Physical packing is in progress. Mark packed when complete.',
      kind: 'action',
    };
  }
  if (status === 'CONFIRMED' || status === 'STOCK_RESERVED') {
    return {
      label: 'Confirmed · ready to process',
      hint: 'Process the order to create the invoice and start packing.',
      kind: 'action',
    };
  }
  return {
    label: fulfillmentStatusLabel(status),
    hint: 'Review order details.',
    kind: 'waiting',
  };
}

/**
 * Single next business action — admin sees one primary button per order state.
 * Flow: Approve → Process → Mark Packed → Deliver → Pay → Sale.
 */
export function getNextOrderAction(order: {
  dbStatus?: string;
  fulfillmentStatus: WholesaleFulfillmentStatus;
  paymentStatus: PaymentStatusVm;
  invoiceNumber?: string | null;
  saleId?: string;
  deliveryPersonId?: string;
  deliveryPersonName?: string;
}): OrderNextAction {
  const db = order.dbStatus ?? '';
  const status = order.fulfillmentStatus;
  const paid = order.paymentStatus === 'PAID';
  const driver = order.deliveryPersonName?.trim();
  const convertible = canConvertOrderToSale({
    fulfillmentStatus: order.fulfillmentStatus,
    paymentStatus: order.paymentStatus,
    saleId: order.saleId,
  });

  if (order.saleId) {
    return {
      id: 'completed',
      label: 'Order Completed',
      hint: 'Sale created · invoice finalized. No further workflow actions.',
      kind: 'done',
      tab: 'invoice',
    };
  }

  if (db === 'CANCELLED' || db === 'DELIVERY_FAILED') {
    return {
      id: 'none',
      label: 'No action',
      hint: 'This order is cancelled or failed.',
      kind: 'done',
    };
  }

  if (status === 'CANCELLED' || status === 'DELIVERY_FAILED') {
    return {
      id: 'none',
      label: 'No action',
      hint: 'This order is cancelled or failed.',
      kind: 'done',
    };
  }

  if (
    db === 'DRAFT_ASSISTED' ||
    db === 'AWAITING_CUSTOMER_CONFIRMATION'
  ) {
    return {
      id: 'confirm_order',
      label: 'Approve Order',
      hint: 'Approve the order to begin fulfilment. Lines remain editable until packing starts.',
      kind: 'action',
      tab: 'overview',
    };
  }

  if (convertible) {
    return {
      id: 'convert_to_sale',
      label: 'Convert To Sale',
      hint: 'Usually automatic after delivery + payment. Use Convert if the sale did not appear.',
      kind: 'action',
      tab: 'invoice',
    };
  }

  if (status === 'DELIVERED' && order.paymentStatus === 'REFUNDED') {
    return {
      id: 'none',
      label: 'Convert To Sale unavailable',
      hint: 'Requires Delivered + PAID. This order payment is refunded.',
      kind: 'done',
      tab: 'payment',
    };
  }

  if (status === 'DELIVERED' && !paid) {
    return {
      id: 'receive_payment',
      label: 'Record Payment',
      hint: 'Mark payment received to unlock sale conversion.',
      kind: 'action',
      tab: 'payment',
    };
  }

  if (status === 'OUT_FOR_DELIVERY') {
    return {
      id: 'waiting_delivery',
      label: driver ? `Out for delivery · ${driver}` : 'Out For Delivery',
      hint: 'Waiting for the delivery person to confirm delivery in the Delivery PWA.',
      kind: 'waiting',
      tab: 'delivery',
    };
  }

  if (status === 'ASSIGNED_TO_ROUTE') {
    return {
      id: 'waiting_driver',
      label: driver ? `Assigned to ${driver}` : 'Delivery Assigned',
      hint: 'Out For Delivery updates automatically when the driver starts the route.',
      kind: 'waiting',
      tab: 'delivery',
    };
  }

  if (status === 'READY_FOR_DISPATCH') {
    if (!order.deliveryPersonId) {
      return {
        id: 'assignment_pending',
        label: 'Assign Delivery',
        hint: 'Automatic assignment did not complete. Schedule delivery manually.',
        kind: 'action',
        tab: 'delivery',
      };
    }
    return {
      id: 'waiting_driver',
      label: driver ? `Assigned to ${driver}` : 'Delivery Assigned',
      hint: 'Packed and assigned. Driver will start the route from the Delivery PWA.',
      kind: 'waiting',
      tab: 'delivery',
    };
  }

  if (status === 'PACKING' || db === 'PROCESSING') {
    return {
      id: 'pack_order',
      label: 'Mark Packed',
      hint: 'Completes packing and tries automatic delivery assignment.',
      kind: 'action',
      tab: 'timeline',
    };
  }

  if (status === 'CONFIRMED' || status === 'STOCK_RESERVED') {
    return {
      id: 'process_order',
      label: 'Process Order',
      hint: 'Creates the invoice, records print, and starts warehouse packing in one step.',
      kind: 'action',
      tab: 'overview',
    };
  }

  return {
    id: 'none',
    label: 'No action',
    hint: 'No next workflow action for this order state.',
    kind: 'done',
  };
}

/** Compact progress steps for the action panel. */
export const ORDER_WORKFLOW_STEPS = [
  'Approve',
  'Process',
  'Pack',
  'Deliver',
  'Pay',
  'Complete',
] as const;

export function orderWorkflowStepIndex(action: OrderNextActionId): number {
  switch (action) {
    case 'confirm_order':
      return 0;
    case 'process_order':
      return 1;
    case 'pack_order':
      return 2;
    case 'assign_delivery':
    case 'assignment_pending':
    case 'waiting_driver':
    case 'waiting_delivery':
      return 3;
    case 'receive_payment':
      return 4;
    case 'convert_to_sale':
      return 5;
    case 'completed':
      return 6;
    default:
      return 0;
  }
}
