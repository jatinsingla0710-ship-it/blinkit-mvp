import type { Order, OrderStatus, OrderStatusEvent } from '@/types';

export type TimelineStageDef = {
  status: OrderStatus;
  label: string;
  explanation: string;
};

/** Fixed wholesale lifecycle shown on Order Timeline v1. */
export const WHOLESALE_ORDER_TIMELINE: TimelineStageDef[] = [
  {
    status: 'AWAITING_CUSTOMER_CONFIRMATION',
    label: 'Awaiting Your Approval',
    explanation: 'Please review and approve this order before stock is reserved.',
  },
  {
    status: 'CONFIRMED',
    label: 'Order Confirmed',
    explanation: 'Your wholesale order is confirmed and locked for fulfilment.',
  },
  {
    status: 'STOCK_RESERVED',
    label: 'Stock Reserved',
    explanation: 'Inventory has been reserved against this order.',
  },
  {
    status: 'PACKING',
    label: 'Packing',
    explanation: 'Warehouse is packing SKUs to your packing list.',
  },
  {
    status: 'READY_FOR_DISPATCH',
    label: 'Ready for Dispatch',
    explanation: 'Order is packed and waiting for route assignment.',
  },
  {
    status: 'ASSIGNED_TO_ROUTE',
    label: 'Assigned to Route',
    explanation: 'Order is assigned to a delivery route for your area.',
  },
  {
    status: 'OUT_FOR_DELIVERY',
    label: 'Out for Delivery',
    explanation: 'Order is on the delivery vehicle to your shop.',
  },
  {
    status: 'DELIVERED',
    label: 'Delivered',
    explanation: 'Order has been delivered to your shop.',
  },
];

export type TimelineStageView = TimelineStageDef & {
  state: 'done' | 'current' | 'upcoming';
  at?: string;
};

export function getOrderStatusLabel(status: OrderStatus): string {
  return (
    WHOLESALE_ORDER_TIMELINE.find((s) => s.status === status)?.label ?? status
  );
}

export function getOrderStatusExplanation(status: OrderStatus): string {
  return (
    WHOLESALE_ORDER_TIMELINE.find((s) => s.status === status)?.explanation ??
    ''
  );
}

export function formatTimelineTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildOrderTimeline(
  status: OrderStatus,
  history: OrderStatusEvent[],
): TimelineStageView[] {
  const activeIndex = WHOLESALE_ORDER_TIMELINE.findIndex(
    (s) => s.status === status,
  );
  const byStatus = new Map(history.map((e) => [e.status, e.at]));

  return WHOLESALE_ORDER_TIMELINE.map((stage, index) => {
    let state: TimelineStageView['state'] = 'upcoming';
    if (activeIndex < 0) {
      state = 'upcoming';
    } else if (index < activeIndex) {
      state = 'done';
    } else if (index === activeIndex) {
      state = 'current';
    }

    return {
      ...stage,
      state,
      at: byStatus.get(stage.status),
    };
  });
}

export function buildCompletedStatusHistory(
  createdAt: string,
): OrderStatusEvent[] {
  const base = new Date(createdAt).getTime();
  return WHOLESALE_ORDER_TIMELINE.map((stage, index) => ({
    status: stage.status,
    at: new Date(base + index * 45 * 60 * 1000).toISOString(),
  }));
}

export function paymentMethodLabel(method: string): string {
  const lower = method.toLowerCase();
  if (lower.includes('cod') || lower.includes('cash')) return 'Cash on Delivery';
  if (lower.includes('online') || lower.includes('upi')) return 'Pay Online';
  return method;
}

export function paymentStatusLabel(
  status: Order['paymentStatus'],
): string {
  switch (status) {
    case 'PAID':
      return 'Paid';
    case 'UNPAID':
      return 'Unpaid';
    case 'PENDING':
      return 'Pending';
  }
}
