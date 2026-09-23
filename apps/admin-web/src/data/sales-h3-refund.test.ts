import { describe, expect, it, vi } from 'vitest';
import { LiveAdminApi } from '@/data/live/LiveAdminApi';
import { canRefundConvertedSale } from '@/data/order-helpers';

describe('Sales H3 refundConvertedSale', () => {
  it('delegates to admin_refund_converted_sale with reason and restock', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        orderId: 'ord-1',
        paymentId: 'pay-1',
        saleId: 'sale-1',
        status: 'REFUNDED',
        alreadyRefunded: false,
        restockedItemCount: 2,
        amount: 1500,
      },
      error: null,
    }));
    const api = new LiveAdminApi({ rpc } as never);
    const result = await api.refundConvertedSale(
      'ord-1',
      'Customer returned goods',
      true,
    );

    expect(rpc).toHaveBeenCalledWith('admin_refund_converted_sale', {
      p_order_id: 'ord-1',
      p_reason: 'Customer returned goods',
      p_restock: true,
    });
    expect(result).toEqual({
      orderId: 'ord-1',
      paymentId: 'pay-1',
      saleId: 'sale-1',
      status: 'REFUNDED',
      alreadyRefunded: false,
      restockedItemCount: 2,
      amount: 1500,
    });
  });

  it('does not perform client payments / sales / inventory CRUD for refund', async () => {
    const from = vi.fn(() => {
      throw new Error('client CRUD must not be used for refund');
    });
    const rpc = vi.fn(async () => ({
      data: {
        orderId: 'ord-1',
        paymentId: 'pay-1',
        saleId: 'sale-1',
        status: 'REFUNDED',
        alreadyRefunded: true,
        restockedItemCount: 0,
        amount: 100,
      },
      error: null,
    }));
    const api = new LiveAdminApi({ rpc, from } as never);
    await api.refundConvertedSale('ord-1', 'Already done', false);
    expect(from).not.toHaveBeenCalled();
  });

  it('surfaces RPC errors', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: 'Refund requires PAID payment (current: UNPAID)' },
    }));
    const api = new LiveAdminApi({ rpc } as never);
    await expect(
      api.refundConvertedSale('ord-1', 'Bad state', false),
    ).rejects.toThrow(/PAID payment/i);
  });
});

describe('Sales H3 canRefundConvertedSale', () => {
  it('allows PAID delivered or converted sales', () => {
    expect(
      canRefundConvertedSale({
        fulfillmentStatus: 'DELIVERED',
        paymentStatus: 'PAID',
        saleId: 'sale-1',
      }),
    ).toBe(true);
    expect(
      canRefundConvertedSale({
        fulfillmentStatus: 'DELIVERED',
        paymentStatus: 'PAID',
      }),
    ).toBe(true);
  });

  it('blocks refunded, unpaid, and non-delivered without sale', () => {
    expect(
      canRefundConvertedSale({
        fulfillmentStatus: 'DELIVERED',
        paymentStatus: 'REFUNDED',
        saleId: 'sale-1',
      }),
    ).toBe(false);
    expect(
      canRefundConvertedSale({
        fulfillmentStatus: 'CONFIRMED',
        paymentStatus: 'PAID',
      }),
    ).toBe(false);
  });
});
