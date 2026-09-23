import { describe, expect, it, vi } from 'vitest';
import { LiveAdminApi } from '@/data/live/LiveAdminApi';

describe('Orders H2 convertOrderToSale', () => {
  it('delegates to admin_convert_order_to_sale and returns conversion fields', async () => {
    const convertedAt = '2026-08-21T12:00:00.000Z';
    const rpc = vi.fn(async () => ({
      data: {
        saleId: 'sale-1',
        invoiceNumber: 'INV-A1000000',
        convertedAt,
        orderId: 'ord-1',
        alreadyConverted: false,
      },
      error: null,
    }));
    const api = new LiveAdminApi({ rpc } as never);
    const result = await api.convertOrderToSale('ord-1');

    expect(rpc).toHaveBeenCalledWith('admin_convert_order_to_sale', {
      p_order_id: 'ord-1',
    });
    expect(result).toEqual({
      saleId: 'sale-1',
      invoiceNumber: 'INV-A1000000',
      convertedAt,
      alreadyConverted: false,
    });
  });

  it('does not perform client sales / sale_items / sales_payments inserts', async () => {
    const from = vi.fn(() => {
      throw new Error('client CRUD must not be used for convert to sale');
    });
    const rpc = vi.fn(async () => ({
      data: {
        saleId: 'sale-1',
        invoiceNumber: 'INV-A1000000',
        convertedAt: '2026-08-21T12:00:00.000Z',
        alreadyConverted: true,
      },
      error: null,
    }));
    const api = new LiveAdminApi({ rpc, from } as never);
    await api.convertOrderToSale('ord-1');
    expect(from).not.toHaveBeenCalled();
  });

  it('surfaces RPC errors for undelivered / unpaid orders', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: {
        message: 'Convert to Sale requires Delivered status (current: CONFIRMED)',
      },
    }));
    const api = new LiveAdminApi({ rpc } as never);
    await expect(api.convertOrderToSale('ord-1')).rejects.toThrow(
      /Delivered status/i,
    );
  });
});
