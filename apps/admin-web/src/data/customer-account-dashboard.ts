import type {
  CustomerAccountSummary,
  CustomerAttentionItem,
  CustomerOrderRow,
  CustomerPaymentRow,
  CustomerTimelineEvent,
} from '@/data/customers-types';
import {
  customerOutstandingTotal,
  oldestOpenReceivableDays,
  type LedgerPaymentInput,
} from '@/data/customer-ledger';
import { ageingBucketLabel, receivableAgeingBucket } from '@/data/customer-ageing';
import { currentFinancialYear } from '@/data/sales-fiscal';
import { formatDateTime, formatInr } from '@/data/live/format';

const TERMINAL_STATUSES = new Set(['CANCELLED', 'DELIVERED']);

export type OrderAggregateRow = {
  id: string;
  status: string;
  total: number;
  created_at: string;
};

export type PaymentAggregateRow = LedgerPaymentInput;

export function isActiveOrderStatus(status: string): boolean {
  const normalized = status.toUpperCase();
  return !TERMINAL_STATUSES.has(normalized);
}

export function customerInitials(shopName: string, ownerName: string): string {
  const source = shopName.trim() || ownerName.trim() || 'C';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function buildCustomerAccountSummary(input: {
  orders: readonly OrderAggregateRow[];
  payments: readonly PaymentAggregateRow[];
}): CustomerAccountSummary {
  const nonCancelled = input.orders.filter(
    (o) => o.status.toUpperCase() !== 'CANCELLED',
  );
  const delivered = nonCancelled.filter(
    (o) => o.status.toUpperCase() === 'DELIVERED',
  );
  const active = nonCancelled.filter((o) => isActiveOrderStatus(o.status));
  const outForDelivery = active.filter(
    (o) => o.status.toUpperCase() === 'OUT_FOR_DELIVERY',
  ).length;

  const lifetimeSales = delivered.reduce((sum, o) => sum + o.total, 0);
  const fy = currentFinancialYear();
  const fySales = delivered
    .filter((o) => {
      const d = new Date(o.created_at);
      return d >= fy.start && d <= fy.end;
    })
    .reduce((sum, o) => sum + o.total, 0);

  const lastDelivered = [...delivered].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];

  const outstanding = customerOutstandingTotal(
    input.orders.map((o) => ({
      id: o.id,
      status: o.status,
      total: o.total,
      created_at: o.created_at,
    })),
    input.payments,
  );

  return {
    totalOrders: nonCancelled.length,
    totalSalesLabel: formatInr(lifetimeSales),
    currentOrders: active.length,
    outForDelivery,
    needsAttention: 0,
    outstandingLabel: outstanding > 0 ? formatInr(outstanding) : null,
    fySalesLabel: formatInr(fySales),
    fyLabel: fy.label,
    completedSalesCount: delivered.length,
    lastPurchaseLabel: lastDelivered
      ? new Date(lastDelivered.created_at).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '—',
  };
}

export type CustomerAttentionOptions = {
  outstanding?: number;
  outstandingLabel?: string | null;
  oldestOpenDays?: number | null;
  collectHref?: string | null;
};

export function buildCustomerAttentionItems(
  orders: readonly CustomerOrderRow[],
  opts: CustomerAttentionOptions = {},
): CustomerAttentionItem[] {
  const items: CustomerAttentionItem[] = [];

  const outstanding = opts.outstanding ?? 0;
  const oldestOpenDays = opts.oldestOpenDays ?? null;
  if (outstanding > 0 && oldestOpenDays != null && oldestOpenDays >= 1) {
    const bucket = receivableAgeingBucket(oldestOpenDays, outstanding);
    const ageLabel =
      oldestOpenDays === 1 ? '1 day' : `${oldestOpenDays} days`;
    items.push({
      id: 'collection-follow-up',
      reason: 'Collection follow-up',
      description: `${opts.outstandingLabel ?? formatInr(outstanding)} due · open ${ageLabel} (${ageingBucketLabel(bucket)}).`,
      actionLabel: opts.collectHref ? 'Record collection' : 'Open ledger',
      href: opts.collectHref ?? '#ledger',
    });
  }

  for (const order of orders) {
    const status = order.fulfillmentStatus.toUpperCase();
    if (status === 'DELIVERY_FAILED') {
      items.push({
        id: `delivery-failed-${order.id}`,
        reason: 'Delivery exception',
        description: `${order.orderCode} could not be delivered.`,
        actionLabel: 'Review order',
        href: `/orders/${order.id}`,
      });
      continue;
    }
    if (
      status === 'DELIVERED' &&
      (order.paymentStatus === 'UNPAID' || order.paymentStatus === 'PENDING')
    ) {
      items.push({
        id: `payment-${order.id}`,
        reason: 'Payment verification pending',
        description: `${order.orderCode} is delivered but payment is not complete.`,
        actionLabel: 'Review payment',
        href: `/orders/${order.id}`,
      });
      continue;
    }
    if (status === 'READY_FOR_DISPATCH') {
      items.push({
        id: `dispatch-${order.id}`,
        reason: 'Ready for dispatch',
        description: `${order.orderCode} is packed and waiting for delivery assignment.`,
        actionLabel: 'Assign delivery',
        href: `/orders/${order.id}`,
      });
    }
  }

  return items.slice(0, 6);
}

export function getActiveCustomerOrders(
  orders: readonly CustomerOrderRow[],
): CustomerOrderRow[] {
  return orders.filter((o) => isActiveOrderStatus(o.fulfillmentStatus));
}

export type CustomerTimelineInput = {
  createdAtLabel: string;
  createdAtIso?: string | null;
  appLinkSentAtLabel?: string | null;
  appLinkSentByLabel?: string | null;
  orders: readonly Pick<
    CustomerOrderRow,
    | 'id'
    | 'orderCode'
    | 'placedAtLabel'
    | 'placedAtIso'
    | 'invoiceNumber'
    | 'fulfillmentLabel'
    | 'fulfillmentStatus'
  >[];
  payments?: readonly Pick<
    CustomerPaymentRow,
    | 'id'
    | 'orderCode'
    | 'amountLabel'
    | 'methodLabel'
    | 'status'
    | 'atLabel'
    | 'atIso'
    | 'orderId'
  >[];
  outstandingLabel?: string | null;
  digitalAccessVm: { activatedAtLabel?: string | null };
};

function timelineAtLabel(
  iso: string | null | undefined,
  fallback: string,
): string {
  if (iso && !Number.isNaN(Date.parse(iso))) return formatDateTime(iso);
  return fallback;
}

export function buildCustomerTimeline(
  customer: CustomerTimelineInput,
): CustomerTimelineEvent[] {
  const events: CustomerTimelineEvent[] = [
    {
      id: 'created',
      atLabel: timelineAtLabel(customer.createdAtIso, customer.createdAtLabel),
      title: 'Customer created',
      sortKey: customer.createdAtIso || customer.createdAtLabel,
    },
  ];

  for (const order of customer.orders.slice(0, 12)) {
    const placedIso = order.placedAtIso;
    const placedLabel = timelineAtLabel(placedIso, order.placedAtLabel);
    const placedSort = placedIso || order.placedAtLabel;

    events.push({
      id: `order-${order.id}`,
      atLabel: placedLabel,
      title: `Order ${order.orderCode} placed`,
      detail: order.fulfillmentLabel,
      sortKey: placedSort,
      href: `/orders/${order.id}`,
    });

    if (order.invoiceNumber) {
      events.push({
        id: `invoice-${order.id}`,
        atLabel: placedLabel,
        title: `Invoice ${order.invoiceNumber}`,
        detail: `For order ${order.orderCode}`,
        sortKey: `${placedSort}|invoice`,
        href: `/orders/${order.id}`,
      });
    }

    if (order.fulfillmentStatus.toUpperCase() === 'DELIVERED') {
      events.push({
        id: `delivered-${order.id}`,
        atLabel: placedLabel,
        title: `Order ${order.orderCode} delivered`,
        sortKey: `${placedSort}|delivered`,
        href: `/orders/${order.id}`,
      });
    }
  }

  for (const payment of customer.payments ?? []) {
    if (payment.status === 'UNPAID' || payment.status === 'PENDING') continue;
    const payIso = payment.atIso;
    const payLabel = timelineAtLabel(payIso, payment.atLabel);
    events.push({
      id: `payment-${payment.id}`,
      atLabel: payLabel,
      title: `Payment received · ${payment.amountLabel}`,
      detail: [payment.methodLabel, payment.orderCode]
        .filter(Boolean)
        .join(' · '),
      sortKey: payIso || payment.atLabel,
      href: payment.orderId ? `/orders/${payment.orderId}` : undefined,
    });
  }

  if (customer.outstandingLabel) {
    events.push({
      id: 'balance',
      atLabel: 'Now',
      title: `Balance due ${customer.outstandingLabel}`,
      sortKey: new Date().toISOString(),
      href: '#ledger',
    });
  }

  return events
    .sort((a, b) => {
      const ta = Date.parse(a.sortKey);
      const tb = Date.parse(b.sortKey);
      if (!Number.isNaN(ta) && !Number.isNaN(tb)) return tb - ta;
      return String(b.sortKey).localeCompare(String(a.sortKey));
    })
    .slice(0, 14);
}

export function attachAttentionCount(
  summary: CustomerAccountSummary,
  attention: readonly CustomerAttentionItem[],
): CustomerAccountSummary {
  return {
    ...summary,
    needsAttention: attention.length,
  };
}

export { oldestOpenReceivableDays };
