import { describe, expect, it, vi } from 'vitest';
import { LiveAdminApi } from '@/data/live/LiveAdminApi';
import { canCancelOrder } from '@/data/order-helpers';

describe('Orders H3 cancelOrder', () => {
  it('delegates to admin_cancel_order', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        orderId: 'ord-1',
        status: 'CANCELLED',
        alreadyCancelled: false,
        reservationsReleased: 2,
        stopsFailed: 1,
      },
      error: null,
    }));
    const api = new LiveAdminApi({ rpc } as never);
    const result = await api.cancelOrder('ord-1', 'Customer cancelled');
    expect(rpc).toHaveBeenCalledWith('admin_cancel_order', {
      p_order_id: 'ord-1',
      p_note: 'Customer cancelled',
    });
    expect(result.reservationsReleased).toBe(2);
    expect(result.stopsFailed).toBe(1);
  });

  it('surfaces RPC errors for converted sales', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: {
        message: 'Cannot cancel an order that has been converted to a sale',
      },
    }));
    const api = new LiveAdminApi({ rpc } as never);
    await expect(api.cancelOrder('ord-1')).rejects.toThrow(/converted to a sale/i);
  });
});

describe('Orders H3 confirmOrderDelivery', () => {
  it('uses delivery_complete_stop when an open stop exists (no route_stops CRUD)', async () => {
    const rpc = vi.fn(async () => ({ data: 'stop-1', error: null }));
    const from = vi.fn((table: string) => {
      if (table === 'route_stops') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: 'stop-1', status: 'IN_PROGRESS' },
                error: null,
              }),
            }),
          }),
          update: () => {
            throw new Error('route_stops CRUD must not be used');
          },
        };
      }
      return {};
    });
    const api = new LiveAdminApi({ rpc, from } as never);
    await api.confirmOrderDelivery('ord-1', 'admin');
    expect(rpc).toHaveBeenCalledWith('delivery_complete_stop', {
      p_stop_id: 'stop-1',
      p_notes: 'Delivery confirmed · Admin confirmation',
      p_photo_captured: false,
      p_signature_captured: false,
      p_collect_cod_amount: null,
    });
    expect(rpc).not.toHaveBeenCalledWith(
      'admin_advance_order_to',
      expect.anything(),
    );
  });

  it('uses admin_advance_order_to when no open stop', async () => {
    const rpc = vi.fn(async () => ({ data: 'ord-1', error: null }));
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      update: () => {
        throw new Error('route_stops CRUD must not be used');
      },
    }));
    const api = new LiveAdminApi({ rpc, from } as never);
    await api.confirmOrderDelivery('ord-1');
    expect(rpc).toHaveBeenCalledWith('admin_advance_order_to', {
      p_order_id: 'ord-1',
      p_to_status: 'DELIVERED',
      p_note: 'Delivery confirmed · Admin confirmation',
    });
  });
});

describe('canCancelOrder', () => {
  it('blocks delivered, cancelled, and converted orders', () => {
    expect(
      canCancelOrder({
        dbStatus: 'DELIVERED',
        fulfillmentStatus: 'DELIVERED',
      }),
    ).toBe(false);
    expect(
      canCancelOrder({
        dbStatus: 'CANCELLED',
        fulfillmentStatus: 'CANCELLED',
      }),
    ).toBe(false);
    expect(
      canCancelOrder({
        dbStatus: 'STOCK_RESERVED',
        fulfillmentStatus: 'STOCK_RESERVED',
        saleId: 'sale-1',
      }),
    ).toBe(false);
    expect(
      canCancelOrder({
        dbStatus: 'STOCK_RESERVED',
        fulfillmentStatus: 'STOCK_RESERVED',
      }),
    ).toBe(true);
  });
});
