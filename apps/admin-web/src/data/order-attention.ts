import type { OrderListRow, OrderNeedingAttention } from '@/data/orders-types';
import {
  fulfillmentStatusLabel,
  getNextOrderAction,
  mapDbOrderStatusToFulfillment,
  type OrderNextAction,
} from '@/data/order-helpers';

export type OrderAttentionReasonCode =
  | 'delivery_failed'
  | 'delivery_exception'
  | 'payment_failed'
  | 'payment_verification_pending'
  | 'sale_conversion_pending'
  | 'assignment_pending'
  | 'exception_flag'
  | 'other';

export type OrderAttentionSeverity = 'critical' | 'action_required' | 'review';

export type OrderAttentionCategory = 'delivery' | 'payment' | 'sale' | 'exception';

export interface OrderAttentionItem {
  orderId: string;
  orderNumber: string;
  customerName: string;
  currentStatus: string;
  attentionReason: string;
  attentionDescription: string;
  attentionCategory: OrderAttentionCategory;
  suggestedAction: string;
  severity: OrderAttentionSeverity;
  createdAt: string;
  reasonCode: OrderAttentionReasonCode;
  attentionDetail?: string;
}

export interface OrdersAttentionSummaryRow {
  reasonCode: OrderAttentionReasonCode;
  count: number;
  label: string;
}

export interface OrdersAttentionResult {
  orders: OrderAttentionItem[];
  count: number;
  summary: OrdersAttentionSummaryRow[];
}

const REASON_META: Record<
  OrderAttentionReasonCode,
  {
    reason: string;
    description: string;
    category: OrderAttentionCategory;
    action: string;
    severity: OrderAttentionSeverity;
  }
> = {
  delivery_failed: {
    reason: 'Delivery could not be completed',
    description: 'The delivery attempt failed. Review what happened and decide the next step.',
    category: 'delivery',
    action: 'Review Delivery',
    severity: 'critical',
  },
  delivery_exception: {
    reason: 'Delivery exception reported',
    description: 'A delivery problem was reported and is still open.',
    category: 'delivery',
    action: 'Review Delivery',
    severity: 'critical',
  },
  payment_failed: {
    reason: 'Payment failed',
    description: 'Payment collection failed or was rejected.',
    category: 'payment',
    action: 'Review Payment',
    severity: 'critical',
  },
  payment_verification_pending: {
    reason: 'Payment verification pending',
    description: 'Driver reported a digital payment that needs admin verification.',
    category: 'payment',
    action: 'Review Payment',
    severity: 'action_required',
  },
  sale_conversion_pending: {
    reason: 'Sale conversion needs attention',
    description: 'Order is delivered and paid but has not been converted to a sale.',
    category: 'sale',
    action: 'Convert To Sale',
    severity: 'action_required',
  },
  assignment_pending: {
    reason: 'Delivery assignment required',
    description: 'Order is packed but no delivery person has been assigned.',
    category: 'delivery',
    action: 'Assign Delivery',
    severity: 'action_required',
  },
  exception_flag: {
    reason: 'Order needs review',
    description: 'An operational exception was logged for this order.',
    category: 'exception',
    action: 'Review Order',
    severity: 'review',
  },
  other: {
    reason: 'Order needs review',
    description: 'This order needs manual review.',
    category: 'exception',
    action: 'Review Order',
    severity: 'review',
  },
};

function normalizeReasonCode(value: string): OrderAttentionReasonCode {
  const code = value.trim().toLowerCase();
  if (code in REASON_META) return code as OrderAttentionReasonCode;
  return 'other';
}

function normalizeSeverity(value: string | undefined): OrderAttentionSeverity {
  if (value === 'critical' || value === 'action_required' || value === 'review') {
    return value;
  }
  return 'review';
}

/** Strip NEEDS_ATTENTION prefix and normalize auto-assign / sale-convert notes. */
export function parseNeedsAttentionNote(note: string): {
  headline: string;
  detail: string;
} {
  const stripped = note.replace(/^NEEDS_ATTENTION:\s*/i, '').trim();
  if (/automatic delivery assignment failed/i.test(stripped)) {
    if (/no service area/i.test(stripped)) {
      return {
        headline: 'Delivery setup incomplete',
        detail: 'This order has no service area configured for delivery assignment.',
      };
    }
    if (/no time slots/i.test(stripped)) {
      return {
        headline: 'Delivery setup incomplete',
        detail: 'No delivery time slots are configured for this territory.',
      };
    }
    if (/no available delivery boy|no available driver/i.test(stripped)) {
      return {
        headline: 'No delivery boy available',
        detail: 'Automatic assignment could not find an available delivery person.',
      };
    }
    return {
      headline: 'Delivery assignment required',
      detail: stripped,
    };
  }
  if (/sale conversion failed after payment verify/i.test(stripped)) {
    return {
      headline: 'Sale conversion needs attention',
      detail: 'Payment was verified but automatic sale conversion failed.',
    };
  }
  if (/sale conversion failed after delivery/i.test(stripped)) {
    return {
      headline: 'Sale conversion needs attention',
      detail: 'Delivery completed but automatic sale conversion failed.',
    };
  }
  if (/sale conversion failed/i.test(stripped)) {
    return {
      headline: 'Sale conversion needs attention',
      detail: stripped,
    };
  }
  return {
    headline: 'Order needs review',
    detail: stripped,
  };
}

function deriveFromDetail(
  reasonCode: OrderAttentionReasonCode,
  attentionDetail?: string,
): Pick<OrderAttentionItem, 'attentionReason' | 'attentionDescription' | 'suggestedAction'> {
  const meta = REASON_META[reasonCode];
  if (!attentionDetail?.trim()) {
    return {
      attentionReason: meta.reason,
      attentionDescription: meta.description,
      suggestedAction: meta.action,
    };
  }

  const detail = attentionDetail.trim();

  if (reasonCode === 'assignment_pending') {
    if (/NEEDS_ATTENTION:/i.test(detail) || /automatic delivery assignment failed/i.test(detail)) {
      const parsed = parseNeedsAttentionNote(detail);
      return {
        attentionReason: parsed.headline,
        attentionDescription: parsed.detail,
        suggestedAction: meta.action,
      };
    }
    return {
      attentionReason: meta.reason,
      attentionDescription: detail,
      suggestedAction: meta.action,
    };
  }

  if (reasonCode === 'exception_flag') {
    const parsed = parseNeedsAttentionNote(
      detail.startsWith('NEEDS_ATTENTION:') ? detail : `NEEDS_ATTENTION: ${detail}`,
    );
    return {
      attentionReason: parsed.headline,
      attentionDescription: parsed.detail,
      suggestedAction: meta.action,
    };
  }

  if (reasonCode === 'delivery_exception') {
    return {
      attentionReason: meta.reason,
      attentionDescription: detail.startsWith('Delivery exception reported')
        ? detail
        : `Delivery exception reported: ${detail}`,
      suggestedAction: meta.action,
    };
  }

  if (reasonCode === 'payment_verification_pending') {
    return {
      attentionReason: meta.reason,
      attentionDescription: detail.includes('REPORTED_AWAITING_VERIFICATION')
        ? 'Driver reported a bank/UPI/online payment awaiting your verification.'
        : detail,
      suggestedAction: meta.action,
    };
  }

  return {
    attentionReason: meta.reason,
    attentionDescription: detail,
    suggestedAction: meta.action,
  };
}

export function mapOrderAttentionItem(input: {
  orderId: string;
  status: string;
  shopName: string;
  reasonCode: string;
  updatedAt: string;
  severity?: string;
  attentionDetail?: string;
  orderNumber?: string;
}): OrderAttentionItem {
  const reasonCode = normalizeReasonCode(input.reasonCode);
  const meta = REASON_META[reasonCode];
  const derived = deriveFromDetail(reasonCode, input.attentionDetail);

  return {
    orderId: input.orderId,
    orderNumber: input.orderNumber ?? input.orderId.slice(0, 8).toUpperCase(),
    customerName: input.shopName || 'Customer',
    currentStatus: fulfillmentStatusLabel(
      mapDbOrderStatusToFulfillment(input.status),
    ),
    attentionReason: derived.attentionReason,
    attentionDescription: derived.attentionDescription,
    attentionCategory: meta.category,
    suggestedAction: derived.suggestedAction,
    severity: input.severity ? normalizeSeverity(input.severity) : meta.severity,
    createdAt: input.updatedAt,
    reasonCode,
    attentionDetail: input.attentionDetail,
  };
}

export function buildOrdersAttentionResult(input: {
  orders: OrderNeedingAttention[];
  count: number;
  summary?: { reasonCode: string; count: number }[];
  orderCodeById?: Map<string, string>;
}): OrdersAttentionResult {
  const items = input.orders.map((row) =>
    mapOrderAttentionItem({
      orderId: row.orderId,
      status: row.status,
      shopName: row.shopName,
      reasonCode: row.reasonCode,
      updatedAt: row.updatedAt,
      severity: row.severity,
      attentionDetail: row.attentionDetail,
      orderNumber: input.orderCodeById?.get(row.orderId),
    }),
  );

  const summaryCounts = new Map<OrderAttentionReasonCode, number>();
  for (const item of items) {
    summaryCounts.set(item.reasonCode, (summaryCounts.get(item.reasonCode) ?? 0) + 1);
  }

  const summary =
    input.summary?.map((row) => ({
      reasonCode: normalizeReasonCode(row.reasonCode),
      count: row.count,
      label: REASON_META[normalizeReasonCode(row.reasonCode)].reason,
    })) ??
    [...summaryCounts.entries()]
      .map(([reasonCode, count]) => ({
        reasonCode,
        count,
        label: REASON_META[reasonCode].reason,
      }))
      .sort((a, b) => b.count - a.count);

  return {
    orders: items,
    count: input.count,
    summary,
  };
}

export function buildAttentionCardCopy(count: number, summary: OrdersAttentionSummaryRow[]): {
  value: string;
  subtitle: string;
  bullets: string[];
} {
  const subtitle =
    count === 0
      ? 'No orders need action right now'
      : count === 1
        ? '1 order requires action'
        : `${count} orders require action`;

  const bullets = summary
    .filter((row) => row.count > 0)
    .slice(0, 3)
    .map((row) => `${row.count} ${row.label}`);

  return {
    value: `${count}`,
    subtitle,
    bullets,
  };
}

export function enrichOrderRowsWithAttention(
  rows: readonly OrderListRow[],
  attention: readonly OrderAttentionItem[],
): OrderListRow[] {
  if (attention.length === 0) {
    return rows.map((row) => ({
      ...row,
      needsAttention: false,
      attentionReason: undefined,
      attentionDescription: undefined,
      attentionCategory: undefined,
      attentionSeverity: undefined,
      suggestedAction: undefined,
    }));
  }

  const byId = new Map(attention.map((item) => [item.orderId, item]));
  const attentionIds = new Set(attention.map((item) => item.orderId));

  return rows.map((row) => {
    const item = byId.get(row.id);
    if (!item) {
      return {
        ...row,
        needsAttention: attentionIds.has(row.id),
        attentionReason: undefined,
        attentionDescription: undefined,
        attentionCategory: undefined,
        attentionSeverity: undefined,
        suggestedAction: undefined,
      };
    }
    return {
      ...row,
      needsAttention: true,
      attentionReason: item.attentionReason,
      attentionDescription: item.attentionDescription,
      attentionCategory: item.attentionCategory,
      attentionSeverity: item.severity,
      suggestedAction: item.suggestedAction,
    };
  });
}

export function filterRowsToAttentionOrderIds(
  rows: readonly OrderListRow[],
  attentionOrderIds: ReadonlySet<string>,
): OrderListRow[] {
  return rows.filter((row) => attentionOrderIds.has(row.id));
}

export function getAttentionAwareNextAction(row: OrderListRow): OrderNextAction {
  if (row.needsAttention && row.suggestedAction) {
    const tab =
      row.attentionCategory === 'payment'
        ? 'payment'
        : row.attentionCategory === 'delivery'
          ? 'delivery'
          : row.attentionCategory === 'sale'
            ? 'invoice'
            : 'overview';

    if (row.suggestedAction === 'Review Payment') {
      return {
        id: 'receive_payment',
        label: 'Review Payment',
        hint: row.attentionDescription ?? 'Verify reported payment before marking paid.',
        kind: 'action',
        tab: 'payment',
      };
    }
    if (row.suggestedAction === 'Assign Delivery') {
      return {
        id: 'assignment_pending',
        label: 'Assign Delivery',
        hint: row.attentionDescription ?? 'Schedule delivery manually.',
        kind: 'action',
        tab: 'delivery',
      };
    }
    if (row.suggestedAction === 'Convert To Sale') {
      return {
        id: 'convert_to_sale',
        label: 'Convert To Sale',
        hint: row.attentionDescription ?? 'Complete sale conversion manually.',
        kind: 'action',
        tab: 'invoice',
      };
    }
    if (row.suggestedAction === 'Review Delivery') {
      return {
        id: 'none',
        label: 'Review Delivery',
        hint: row.attentionDescription ?? 'Open delivery details and resolve the issue.',
        kind: 'action',
        tab: 'delivery',
      };
    }
    return {
      id: 'none',
      label: row.suggestedAction,
      hint: row.attentionDescription ?? 'Review this order.',
      kind: 'action',
      tab,
    };
  }

  return getNextOrderAction({
    dbStatus: row.dbStatus,
    fulfillmentStatus: row.fulfillmentStatus,
    paymentStatus: row.paymentStatus,
    invoiceNumber: row.invoiceNumber,
    saleId: row.saleId,
    deliveryPersonId: row.deliveryPersonId,
    deliveryPersonName: row.deliveryPersonName,
  });
}

export function attentionReasonLabel(reasonCode: OrderAttentionReasonCode): string {
  return REASON_META[reasonCode].reason;
}
