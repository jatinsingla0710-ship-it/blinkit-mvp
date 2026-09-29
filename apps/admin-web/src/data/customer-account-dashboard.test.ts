import { describe, expect, it } from 'vitest';

import {
  attachAttentionCount,
  buildCustomerAccountSummary,
  buildCustomerAttentionItems,
  buildCustomerTimeline,
  customerInitials,
  getActiveCustomerOrders,
  isActiveOrderStatus,
} from '@/data/customer-account-dashboard';
import type { CustomerOrderRow } from '@/data/customers-types';
import { getCustomerDetailFixture } from '@/data/customers-fixtures';

describe('customer account dashboard', () => {
  it('derives initials from shop or owner name', () => {
    expect(customerInitials('ABC Traders', 'Rajesh Kumar')).toBe('AT');
    expect(customerInitials('Solo', '')).toBe('SO');
  });

  it('counts active and delivered orders in summary', () => {
    const summary = buildCustomerAccountSummary({
      orders: [
        {
          id: '1',
          status: 'DELIVERED',
          total: 1000,
          created_at: '2026-07-01T10:00:00.000Z',
        },
        {
          id: '2',
          status: 'PACKING',
          total: 500,
          created_at: '2026-07-10T10:00:00.000Z',
        },
        {
          id: '3',
          status: 'CANCELLED',
          total: 200,
          created_at: '2026-07-11T10:00:00.000Z',
        },
      ],
      payments: [],
    });

    expect(summary.totalOrders).toBe(2);
    expect(summary.currentOrders).toBe(1);
    expect(summary.completedSalesCount).toBe(1);
    expect(summary.totalSalesLabel).toContain('1,000');
  });

  it('flags ready-for-dispatch and unpaid delivered orders', () => {
    const orders: CustomerOrderRow[] = [
      {
        id: 'a',
        orderCode: 'GA-1',
        valueLabel: '₹1,000',
        fulfillmentLabel: 'Ready for Dispatch',
        fulfillmentStatus: 'READY_FOR_DISPATCH',
        paymentStatus: 'PAID',
        placedAtLabel: 'Today',
        totalAmount: 1000,
      },
      {
        id: 'b',
        orderCode: 'GA-2',
        valueLabel: '₹2,000',
        fulfillmentLabel: 'Delivered',
        fulfillmentStatus: 'DELIVERED',
        paymentStatus: 'UNPAID',
        placedAtLabel: 'Yesterday',
        totalAmount: 2000,
      },
    ];

    const items = buildCustomerAttentionItems(orders);
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.reason)).toEqual(
      expect.arrayContaining([
        'Ready for dispatch',
        'Payment verification pending',
      ]),
    );
  });

  it('filters active orders for current activity', () => {
    const orders: CustomerOrderRow[] = [
      {
        id: '1',
        orderCode: 'GA-1',
        valueLabel: '₹1',
        fulfillmentLabel: 'Packing',
        fulfillmentStatus: 'PACKING',
        paymentStatus: 'UNPAID',
        placedAtLabel: 'Today',
        totalAmount: 1,
      },
      {
        id: '2',
        orderCode: 'GA-2',
        valueLabel: '₹2',
        fulfillmentLabel: 'Delivered',
        fulfillmentStatus: 'DELIVERED',
        paymentStatus: 'PAID',
        placedAtLabel: 'Yesterday',
        totalAmount: 2,
      },
    ];

    expect(isActiveOrderStatus('DELIVERED')).toBe(false);
    expect(getActiveCustomerOrders(orders)).toHaveLength(1);
  });

  it('hydrates fixture detail with summary and timeline', () => {
    const detail = getCustomerDetailFixture('cust-sharma');
    expect(detail).not.toBeNull();
    expect(detail!.summary.totalOrders).toBeGreaterThan(0);
    expect(detail!.timeline.length).toBeGreaterThan(0);
  });

  it('attaches attention count to summary', () => {
    const summary = attachAttentionCount(
      buildCustomerAccountSummary({ orders: [], payments: [] }),
      [{ id: '1', reason: 'x', description: 'y', actionLabel: 'Go', href: '/orders/1' }],
    );
    expect(summary.needsAttention).toBe(1);
  });

  it('builds timeline from customer detail fields', () => {
    const customer = {
      createdAtLabel: '01 Jan 2026',
      appLinkSentAtLabel: '02 Jan 2026',
      orders: [],
      digitalAccessVm: { activatedAtLabel: '03 Jan 2026' },
    };

    const events = buildCustomerTimeline(customer);
    expect(events.some((event) => event.title === 'Customer created')).toBe(true);
    expect(events.some((event) => event.title === 'App link sent')).toBe(false);
    expect(events.some((event) => event.title === 'Customer App activated')).toBe(
      false,
    );
  });
});
