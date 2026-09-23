import { describe, expect, it } from 'vitest';

import {
  buildAttentionCardCopy,
  buildOrdersAttentionResult,
  enrichOrderRowsWithAttention,
  filterRowsToAttentionOrderIds,
  mapOrderAttentionItem,
  parseNeedsAttentionNote,
} from '@/data/order-attention';
import type { OrderListRow } from '@/data/orders-types';

function baseRow(overrides: Partial<OrderListRow> = {}): OrderListRow {
  return {
    id: 'order-1',
    orderCode: 'GA-1024',
    customerName: 'Test Shop',
    orderValueLabel: 'Rs 1,000',
    paymentStatus: 'UNPAID',
    fulfillmentStatus: 'READY_FOR_DISPATCH',
    deliveryStatus: 'not_started',
    salesmanName: 'Rep',
    warehouseName: 'Area 1',
    updatedAtLabel: 'Today',
    placedAtLabel: 'Today',
    placedAtIso: '2026-09-01T10:00:00.000Z',
    updatedAtIso: '2026-09-01T10:00:00.000Z',
    dbStatus: 'READY_FOR_DISPATCH',
    ...overrides,
  };
}

describe('order attention mapping', () => {
  it('packed order with no delivery assignment maps to delivery assignment required', () => {
    const item = mapOrderAttentionItem({
      orderId: 'order-1',
      status: 'READY_FOR_DISPATCH',
      shopName: 'Test Shop',
      reasonCode: 'assignment_pending',
      updatedAt: '2026-09-01T10:00:00.000Z',
      orderNumber: 'GA-1024',
    });

    expect(item.attentionReason).toBe('Delivery assignment required');
    expect(item.suggestedAction).toBe('Assign Delivery');
    expect(item.severity).toBe('action_required');
  });

  it('digital payment pending verification maps to review payment', () => {
    const item = mapOrderAttentionItem({
      orderId: 'order-2',
      status: 'DELIVERED',
      shopName: 'Cafe',
      reasonCode: 'payment_verification_pending',
      updatedAt: '2026-09-01T11:00:00.000Z',
      attentionDetail:
        'REPORTED_AWAITING_VERIFICATION · UPI_ON_DELIVERY · Rs 500',
    });

    expect(item.attentionReason).toBe('Payment verification pending');
    expect(item.suggestedAction).toBe('Review Payment');
    expect(item.attentionDescription).toContain('awaiting your verification');
  });

  it('unresolved delivery exception maps to review delivery', () => {
    const item = mapOrderAttentionItem({
      orderId: 'order-3',
      status: 'OUT_FOR_DELIVERY',
      shopName: 'Store',
      reasonCode: 'delivery_exception',
      updatedAt: '2026-09-01T12:00:00.000Z',
      attentionDetail: 'CUSTOMER_UNAVAILABLE · Customer not answering',
    });

    expect(item.attentionReason).toBe('Delivery exception reported');
    expect(item.suggestedAction).toBe('Review Delivery');
  });

  it('parses NEEDS_ATTENTION auto-assign notes into readable reasons', () => {
    const parsed = parseNeedsAttentionNote(
      'NEEDS_ATTENTION: Automatic delivery assignment failed - no available delivery boy',
    );
    expect(parsed.headline).toBe('No delivery boy available');
    expect(parsed.detail).toContain('delivery person');
  });

  it('buildAttentionCardCopy summarizes counts by reason', () => {
    const copy = buildAttentionCardCopy(5, [
      { reasonCode: 'assignment_pending', count: 3, label: 'Delivery assignment required' },
      { reasonCode: 'payment_verification_pending', count: 1, label: 'Payment verification pending' },
      { reasonCode: 'delivery_exception', count: 1, label: 'Delivery exception reported' },
    ]);

    expect(copy.subtitle).toBe('5 orders require action');
    expect(copy.bullets).toEqual([
      '3 Delivery assignment required',
      '1 Payment verification pending',
      '1 Delivery exception reported',
    ]);
  });
});

describe('order attention list enrichment', () => {
  it('enriches only RPC attention orders and clears others', () => {
    const attention = buildOrdersAttentionResult({
      count: 1,
      orders: [
        {
          orderId: 'order-1',
          status: 'READY_FOR_DISPATCH',
          total: 1000,
          updatedAt: '2026-09-01T10:00:00.000Z',
          shopName: 'Test Shop',
          reasonCode: 'assignment_pending',
          priority: 5,
        },
      ],
      orderCodeById: new Map([['order-1', 'GA-1024']]),
    });

    const enriched = enrichOrderRowsWithAttention(
      [baseRow(), baseRow({ id: 'order-2', orderCode: 'GA-1025' })],
      attention.orders,
    );

    expect(enriched[0]?.needsAttention).toBe(true);
    expect(enriched[0]?.attentionReason).toBe('Delivery assignment required');
    expect(enriched[1]?.needsAttention).toBe(false);
  });

  it('filterRowsToAttentionOrderIds matches RPC order set', () => {
    const rows = [
      baseRow({ id: 'order-1' }),
      baseRow({ id: 'order-2' }),
      baseRow({ id: 'order-3' }),
    ];
    const filtered = filterRowsToAttentionOrderIds(
      rows,
      new Set(['order-1', 'order-3']),
    );
    expect(filtered.map((row) => row.id)).toEqual(['order-1', 'order-3']);
  });

  it('historical resolved attention orders are not enriched when absent from RPC', () => {
    const enriched = enrichOrderRowsWithAttention(
      [
        baseRow({
          id: 'order-old',
          needsAttention: true,
          attentionReason: 'Exception flag',
        }),
      ],
      [],
    );
    expect(enriched[0]?.needsAttention).toBe(false);
    expect(enriched[0]?.attentionReason).toBeUndefined();
  });
});
