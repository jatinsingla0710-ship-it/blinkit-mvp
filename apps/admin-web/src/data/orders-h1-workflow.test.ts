import { describe, expect, it, vi } from 'vitest';

import { LiveAdminApi } from '@/data/live/LiveAdminApi';

import {

  buildOrderTimeline,

  fulfillmentStatusLabel,

  mapDbOrderStatusToFulfillment,

} from '@/data/order-helpers';



describe('Orders H1 invoice / payment RPC wiring', () => {

  it('recordInvoicePrinted uses admin_record_invoice_printed (no status advance)', async () => {

    const rpc = vi.fn(async () => ({ data: 'ord-1', error: null }));

    const api = new LiveAdminApi({ rpc } as never);

    await api.recordInvoicePrinted('ord-1');

    expect(rpc).toHaveBeenCalledWith('admin_record_invoice_printed', {

      p_order_id: 'ord-1',

      p_note: 'Invoice printed',

    });

    expect(rpc).not.toHaveBeenCalledWith(

      'admin_advance_order_to',

      expect.anything(),

    );

  });



  it('processOrder chains invoice, print, and start packing RPCs', async () => {

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

    expect(rpc).toHaveBeenCalledWith('admin_record_invoice_printed', {

      p_order_id: 'ord-1',

      p_note: 'Invoice printed',

    });

    expect(rpc).toHaveBeenCalledWith('admin_start_packing', {

      p_order_id: 'ord-1',

    });

  });



  it('processOrder skips steps already completed', async () => {

    const rpc = vi.fn(async () => ({ data: 'ord-1', error: null }));

    const api = new LiveAdminApi({ rpc } as never);

    await api.processOrder('ord-1', {

      hasInvoice: true,

      invoicePrinted: true,

      dbStatus: 'PROCESSING',

    });

    expect(rpc).not.toHaveBeenCalled();

  });



  it('markOrderPaymentReceived uses admin_mark_payment_received', async () => {

    const rpc = vi.fn(async () => ({ data: 'pay-1', error: null }));

    const api = new LiveAdminApi({ rpc } as never);

    await api.markOrderPaymentReceived('ord-1', 'UPI_ON_DELIVERY');

    expect(rpc).toHaveBeenCalledWith('admin_mark_payment_received', {

      p_order_id: 'ord-1',

      p_collection_method: 'UPI_ON_DELIVERY',

      p_note: 'Payment received',

    });

  });

});



describe('Orders H1 status / payment mappings', () => {

  it('maps CANCELLED and DELIVERY_FAILED honestly', () => {

    expect(mapDbOrderStatusToFulfillment('CANCELLED')).toBe('CANCELLED');

    expect(mapDbOrderStatusToFulfillment('DELIVERY_FAILED')).toBe(

      'DELIVERY_FAILED',

    );

    expect(fulfillmentStatusLabel('STOCK_RESERVED')).toBe('Stock Reserved');

  });



  it('uses invoice created as a distinct timeline stage', () => {

    const stages = buildOrderTimeline(

      'STOCK_RESERVED',

      { STOCK_RESERVED: '15 Aug 2026, 10:00' },

      { STOCK_RESERVED: 'Admin' },

      {

        createdAt: '15 Aug 2026, 09:00',

        invoiceCreatedAt: '15 Aug 2026, 10:30',

        invoiceCreatedActor: 'Admin',

        hasInvoice: true,

      },

    );

    const invoice = stages.find((s) => s.status === 'INVOICE_CREATED');

    expect(invoice?.label).toBe('Invoice Created');

    expect(invoice?.state).toBe('done');

    expect(invoice?.at).toBe('15 Aug 2026, 10:30');

  });



  it('does not mark invoice created without invoice data', () => {

    const stages = buildOrderTimeline(

      'STOCK_RESERVED',

      { STOCK_RESERVED: '15 Aug 2026, 10:00' },

      undefined,

      { createdAt: '15 Aug 2026, 09:00' },

    );

    const invoice = stages.find((s) => s.status === 'INVOICE_CREATED');

    expect(invoice?.state).toBe('upcoming');

    expect(invoice?.at).toBeUndefined();

  });

});


