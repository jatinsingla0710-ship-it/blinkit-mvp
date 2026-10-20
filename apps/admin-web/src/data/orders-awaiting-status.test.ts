import { describe, expect, it } from 'vitest';
import {
  applyOrdersListPreset,
  buildOrderTimeline,
  fulfillmentStatusLabel,
  getNextOrderAction,
  getOrderBusinessStage,
  mapDbOrderStatusToFulfillment,
  orderCountsAsProcessing,
} from '@/data/order-helpers';
import type { OrderListRow } from '@/data/orders-types';

function row(
  patch: Pick<OrderListRow, 'fulfillmentStatus'> &
    Partial<Pick<OrderListRow, 'dbStatus' | 'id'>>,
): OrderListRow {
  return {
    id: patch.id ?? 'ord-1',
    orderCode: 'GA-1',
    customerName: 'Sharma Kirana',
    orderValueLabel: '₹1',
    paymentStatus: 'UNPAID',
    fulfillmentStatus: patch.fulfillmentStatus,
    deliveryStatus: 'not_started',
    salesmanName: 'Priya',
    warehouseName: 'Hub',
    updatedAtLabel: '—',
    placedAtLabel: '—',
    placedAtIso: '2026-10-15T00:00:00.000Z',
    updatedAtIso: '2026-10-15T00:00:00.000Z',
    dbStatus: patch.dbStatus,
  };
}

describe('awaiting customer confirmation fulfillment status', () => {
  it('does not label awaiting confirmation as Confirmed', () => {
    expect(mapDbOrderStatusToFulfillment('AWAITING_CUSTOMER_CONFIRMATION')).toBe(
      'AWAITING_CUSTOMER_CONFIRMATION',
    );
    expect(mapDbOrderStatusToFulfillment('DRAFT_ASSISTED')).toBe('DRAFT_ASSISTED');
    expect(fulfillmentStatusLabel('DRAFT_ASSISTED')).toBe('Draft');
    expect(mapDbOrderStatusToFulfillment('CONFIRMED')).toBe('CONFIRMED');
    expect(fulfillmentStatusLabel('AWAITING_CUSTOMER_CONFIRMATION')).toBe(
      'Awaiting customer confirmation',
    );
  });

  it('keeps awaiting orders out of pending and processing lists', () => {
    const awaiting = row({
      id: 'awaiting',
      fulfillmentStatus: 'AWAITING_CUSTOMER_CONFIRMATION',
      dbStatus: 'AWAITING_CUSTOMER_CONFIRMATION',
    });
    const draft = row({
      id: 'draft',
      fulfillmentStatus: 'DRAFT_ASSISTED',
      dbStatus: 'DRAFT_ASSISTED',
    });
    const confirmed = row({
      id: 'confirmed',
      fulfillmentStatus: 'CONFIRMED',
      dbStatus: 'CONFIRMED',
    });
    const packing = row({
      id: 'packing',
      fulfillmentStatus: 'PACKING',
      dbStatus: 'PROCESSING',
    });
    const rows = [awaiting, draft, confirmed, packing];

    expect(applyOrdersListPreset(rows, 'pending').map((r) => r.id)).toEqual([
      'confirmed',
      'packing',
    ]);
    expect(applyOrdersListPreset(rows, 'processing').map((r) => r.id)).toEqual([
      'confirmed',
      'packing',
    ]);
    expect(
      applyOrdersListPreset(rows, 'awaiting_approval').map((r) => r.id),
    ).toEqual(['awaiting', 'draft']);
    expect(orderCountsAsProcessing(awaiting)).toBe(false);
    expect(orderCountsAsProcessing(draft)).toBe(false);
    expect(orderCountsAsProcessing(confirmed)).toBe(true);
  });

  it('keeps the timeline before Confirmed and still offers Approve', () => {
    const stages = buildOrderTimeline(
      'AWAITING_CUSTOMER_CONFIRMATION',
      {},
      {},
      { createdAt: '15 Oct 2026, 09:00' },
    );
    const received = stages.find((s) => s.status === 'ORDER_CREATED');
    const confirmed = stages.find((s) => s.status === 'CONFIRMED');
    expect(received?.state).toBe('current');
    expect(confirmed?.state).toBe('upcoming');
    expect(confirmed?.at).toBeUndefined();

    const next = getNextOrderAction({
      fulfillmentStatus: 'AWAITING_CUSTOMER_CONFIRMATION',
      paymentStatus: 'UNPAID',
    });
    expect(next.id).toBe('confirm_order');
    expect(
      getOrderBusinessStage({
        fulfillmentStatus: 'AWAITING_CUSTOMER_CONFIRMATION',
        paymentStatus: 'UNPAID',
      }).label,
    ).toBe('Awaiting approval');
  });
});
