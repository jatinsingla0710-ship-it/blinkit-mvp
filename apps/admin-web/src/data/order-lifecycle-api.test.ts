import { describe, expect, it, vi } from 'vitest';
import { LiveAdminApi } from '@/data/live/LiveAdminApi';

describe('order lifecycle API RPC wiring', () => {
  it('createOrderInvoice uses admin_create_order_invoice', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        orderId: 'ord-1',
        invoiceNumber: 'INV-ORD1',
        invoiceCreatedAt: '2026-08-27T10:00:00Z',
        alreadyCreated: false,
      },
      error: null,
    }));
    const api = new LiveAdminApi({ rpc } as never);
    const result = await api.createOrderInvoice('ord-1');
    expect(rpc).toHaveBeenCalledWith('admin_create_order_invoice', {
      p_order_id: 'ord-1',
    });
    expect(result.invoiceNumber).toBe('INV-ORD1');
  });

  it('startPacking uses admin_start_packing', async () => {
    const rpc = vi.fn(async () => ({ data: 'ord-1', error: null }));
    const api = new LiveAdminApi({ rpc } as never);
    await api.startPacking('ord-1');
    expect(rpc).toHaveBeenCalledWith('admin_start_packing', {
      p_order_id: 'ord-1',
    });
  });

  it('processOrder chains invoice + print + packing when needed', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'admin_create_order_invoice') {
        return {
          data: {
            orderId: 'ord-1',
            invoiceNumber: 'INV-ORD1',
            invoiceCreatedAt: '2026-08-27T10:00:00Z',
          },
          error: null,
        };
      }
      return { data: 'ord-1', error: null };
    });
    const api = new LiveAdminApi({ rpc } as never);
    await api.processOrder('ord-1', {
      hasInvoice: false,
      invoicePrinted: false,
      dbStatus: 'CONFIRMED',
    });
    expect(rpc).toHaveBeenCalledWith('admin_create_order_invoice', {
      p_order_id: 'ord-1',
    });
    expect(rpc).toHaveBeenCalledWith('admin_start_packing', {
      p_order_id: 'ord-1',
    });
  });

  it('packOrder uses admin_pack_order (not advance-only)', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        orderId: 'ord-1',
        status: 'READY_FOR_DISPATCH',
        alreadyPacked: false,
        autoAssign: { assigned: false, needsAttention: true, reason: 'No driver' },
      },
      error: null,
    }));
    const api = new LiveAdminApi({ rpc } as never);
    const result = await api.packOrder('ord-1');
    expect(rpc).toHaveBeenCalledWith('admin_pack_order', {
      p_order_id: 'ord-1',
    });
    expect(rpc).not.toHaveBeenCalledWith('admin_advance_order_to', expect.anything());
    expect(result.autoAssign.needsAttention).toBe(true);
    expect(result.alreadyPacked).toBe(false);
  });

  it('packOrder surfaces alreadyPacked from RPC', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        orderId: 'ord-1',
        status: 'READY_FOR_DISPATCH',
        alreadyPacked: true,
        autoAssign: { assigned: true, alreadyAssigned: true },
      },
      error: null,
    }));
    const api = new LiveAdminApi({ rpc } as never);
    const result = await api.packOrder('ord-1');
    expect(result.alreadyPacked).toBe(true);
    expect(result.autoAssign.alreadyAssigned).toBe(true);
  });

  it('replaceOrderLines uses admin_replace_order_lines', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        orderId: 'ord-1',
        lineCount: 2,
        subtotal: 500,
        total: 500,
      },
      error: null,
    }));
    const api = new LiveAdminApi({ rpc } as never);
    await api.replaceOrderLines('ord-1', [
      { skuId: 'sku-1', quantity: 2, unitPrice: 250 },
    ]);
    expect(rpc).toHaveBeenCalledWith('admin_replace_order_lines', {
      p_order_id: 'ord-1',
      p_lines: [{ skuId: 'sku-1', quantity: 2, unitPrice: 250 }],
    });
  });

  it('listOrdersNeedingAttention uses admin_orders_needing_attention', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        count: 1,
        summary: [{ reason_code: 'assignment_pending', count: 1 }],
        orders: [
          {
            order_id: 'ord-1',
            status: 'READY_FOR_DISPATCH',
            total: 1000,
            updated_at: '2026-08-27T10:00:00Z',
            shop_name: 'Test Shop',
            reason_code: 'assignment_pending',
            priority: 4,
          },
        ],
      },
      error: null,
    }));
    const api = new LiveAdminApi({ rpc } as never);
    const result = await api.listOrdersNeedingAttention(25);
    expect(rpc).toHaveBeenCalledWith('admin_orders_needing_attention', {
      p_limit: 25,
    });
    expect(result.count).toBe(1);
    expect(result.summary[0]?.reasonCode).toBe('assignment_pending');
    expect(result.orders[0]?.reasonCode).toBe('assignment_pending');
  });
});
