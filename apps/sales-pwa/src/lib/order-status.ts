import type { BadgeTone } from '@groaurum/ui';

/** Sales history tabs over the existing public.order_status enum (no new statuses). */
export type OrderStatusGroup = 'pending' | 'approved' | 'delivered' | 'cancelled';

export const ORDER_STATUS_GROUPS: { id: OrderStatusGroup; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
];

const GROUP_BY_STATUS: Record<string, OrderStatusGroup> = {
  DRAFT_ASSISTED: 'pending',
  AWAITING_CUSTOMER_CONFIRMATION: 'pending',
  CONFIRMED: 'approved',
  STOCK_RESERVED: 'approved',
  PROCESSING: 'approved',
  READY_FOR_DISPATCH: 'approved',
  ASSIGNED_TO_ROUTE: 'approved',
  OUT_FOR_DELIVERY: 'approved',
  // Approved by the customer but not yet delivered or cancelled.
  DELIVERY_FAILED: 'approved',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

const LABEL_BY_STATUS: Record<string, string> = {
  DRAFT_ASSISTED: 'Draft',
  AWAITING_CUSTOMER_CONFIRMATION: 'Awaiting customer approval',
  CONFIRMED: 'Approved by customer',
  STOCK_RESERVED: 'Stock reserved',
  PROCESSING: 'Processing',
  READY_FOR_DISPATCH: 'Ready for dispatch',
  ASSIGNED_TO_ROUTE: 'Assigned to route',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERY_FAILED: 'Delivery failed',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

/** Unknown statuses stay visible under Pending rather than disappearing. */
export function orderStatusGroup(status: string): OrderStatusGroup {
  return GROUP_BY_STATUS[status] ?? 'pending';
}

export function orderStatusLabel(status: string): string {
  return LABEL_BY_STATUS[status] ?? status;
}

export function orderStatusTone(status: string): BadgeTone {
  if (status === 'DELIVERY_FAILED' || status === 'CANCELLED') return 'danger';
  if (status === 'DELIVERED') return 'success';
  const group = orderStatusGroup(status);
  if (group === 'pending') return 'warning';
  return 'info';
}

export function isOrderStatusGroup(value: string | null): value is OrderStatusGroup {
  return ORDER_STATUS_GROUPS.some((g) => g.id === value);
}

export function groupOrdersByStatus<T extends { status: string }>(
  orders: readonly T[],
): Record<OrderStatusGroup, T[]> {
  const out: Record<OrderStatusGroup, T[]> = {
    pending: [],
    approved: [],
    delivered: [],
    cancelled: [],
  };
  for (const order of orders) {
    out[orderStatusGroup(order.status)].push(order);
  }
  return out;
}
