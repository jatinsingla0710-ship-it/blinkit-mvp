import { describe, expect, it } from 'vitest';
import {
  groupOrdersByStatus,
  orderStatusGroup,
  orderStatusLabel,
  orderStatusTone,
} from './order-status';

const ALL_STATUSES = [
  'DRAFT_ASSISTED',
  'AWAITING_CUSTOMER_CONFIRMATION',
  'CONFIRMED',
  'STOCK_RESERVED',
  'PROCESSING',
  'READY_FOR_DISPATCH',
  'ASSIGNED_TO_ROUTE',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DELIVERY_FAILED',
  'CANCELLED',
];

describe('order status grouping (D)', () => {
  it('maps every existing order_status to exactly one tab', () => {
    expect(ALL_STATUSES.map((s) => [s, orderStatusGroup(s)])).toEqual([
      ['DRAFT_ASSISTED', 'pending'],
      ['AWAITING_CUSTOMER_CONFIRMATION', 'pending'],
      ['CONFIRMED', 'approved'],
      ['STOCK_RESERVED', 'approved'],
      ['PROCESSING', 'approved'],
      ['READY_FOR_DISPATCH', 'approved'],
      ['ASSIGNED_TO_ROUTE', 'approved'],
      ['OUT_FOR_DELIVERY', 'approved'],
      ['DELIVERED', 'delivered'],
      ['DELIVERY_FAILED', 'approved'],
      ['CANCELLED', 'cancelled'],
    ]);
  });

  it('never claims approved or delivered for a pending order', () => {
    expect(orderStatusLabel('AWAITING_CUSTOMER_CONFIRMATION')).toBe('Awaiting customer approval');
    expect(orderStatusTone('AWAITING_CUSTOMER_CONFIRMATION')).toBe('warning');
    expect(orderStatusTone('DELIVERED')).toBe('success');
    expect(orderStatusTone('DELIVERY_FAILED')).toBe('danger');
    expect(orderStatusTone('CANCELLED')).toBe('danger');
  });

  it('keeps unknown statuses visible under Pending with their raw name', () => {
    expect(orderStatusGroup('SOMETHING_NEW')).toBe('pending');
    expect(orderStatusLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });

  it('groups a list of orders', () => {
    const grouped = groupOrdersByStatus([
      { id: '1', status: 'AWAITING_CUSTOMER_CONFIRMATION' },
      { id: '2', status: 'OUT_FOR_DELIVERY' },
      { id: '3', status: 'DELIVERED' },
      { id: '4', status: 'CANCELLED' },
      { id: '5', status: 'CONFIRMED' },
    ]);
    expect(grouped.pending.map((o) => o.id)).toEqual(['1']);
    expect(grouped.approved.map((o) => o.id)).toEqual(['2', '5']);
    expect(grouped.delivered.map((o) => o.id)).toEqual(['3']);
    expect(grouped.cancelled.map((o) => o.id)).toEqual(['4']);
  });
});
