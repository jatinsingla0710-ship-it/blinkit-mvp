import type {
  CustomerAccountSummary,
  CustomerAttentionItem,
  CustomerOrderRow,
  CustomerTimelineEvent,
} from '@/data/customers-types';
import { currentFinancialYear } from '@/data/sales-fiscal';
import { formatInr } from '@/data/live/format';

const TERMINAL_STATUSES = new Set(['CANCELLED', 'DELIVERED']);

export type OrderAggregateRow = {
  id: string;
  status: string;
  total: number;
  created_at: string;
};

export type PaymentAggregateRow = {
  order_id: string;
  status: string;
  amount: number;
};

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

  const outstanding = input.payments
    .filter((p) => {
      const s = p.status.toUpperCase();
      return s === 'UNPAID' || s === 'PENDING' || s === 'PAYMENT_PENDING';
    })
    .reduce((sum, p) => sum + p.amount, 0);

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

export function buildCustomerAttentionItems(
  orders: readonly CustomerOrderRow[],
): CustomerAttentionItem[] {
  const items: CustomerAttentionItem[] = [];

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
  appLinkSentAtLabel?: string | null;
  appLinkSentByLabel?: string | null;
  orders: readonly Pick<
    CustomerOrderRow,
    | 'id'
    | 'orderCode'
    | 'placedAtLabel'
    | 'fulfillmentLabel'
    | 'fulfillmentStatus'
  >[];
  digitalAccessVm: { activatedAtLabel?: string | null };
};

export function buildCustomerTimeline(
  customer: CustomerTimelineInput,
): CustomerTimelineEvent[] {
  const events: CustomerTimelineEvent[] = [
    {
      id: 'created',
      atLabel: customer.createdAtLabel,
      title: 'Customer created',
      sortKey: customer.createdAtLabel,
    },
  ];

  for (const order of customer.orders.slice(0, 8)) {
    events.push({
      id: `order-${order.id}`,
      atLabel: order.placedAtLabel,
      title: `Order ${order.orderCode} placed`,
      detail: order.fulfillmentLabel,
      sortKey: order.placedAtLabel,
      href: `/orders/${order.id}`,
    });
    if (order.fulfillmentStatus.toUpperCase() === 'DELIVERED') {
      events.push({
        id: `delivered-${order.id}`,
        atLabel: order.placedAtLabel,
        title: `Order ${order.orderCode} delivered`,
        sortKey: order.placedAtLabel,
        href: `/orders/${order.id}`,
      });
    }
  }

  return events
    .sort((a, b) => {
      const ta = Date.parse(a.sortKey);
      const tb = Date.parse(b.sortKey);
      if (!Number.isNaN(ta) && !Number.isNaN(tb)) return tb - ta;
      return 0;
    })
    .slice(0, 10);
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
