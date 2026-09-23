import { describe, expect, it } from 'vitest';
import {
  mapSaleItemsToOrderLines,
  mapSaleToPaymentSummary,
} from './sale-invoice-map';

describe('Sales H2 sale invoice mapping', () => {
  it('maps sale_items into invoice line view-models', () => {
    const lines = mapSaleItemsToOrderLines([
      {
        id: 'si-1',
        product_name: 'Almonds Premium',
        sku_code: 'ALM-1',
        sku_name: '1kg',
        quantity: 2,
        unit_price: 500.5,
        discount: 10,
        line_total: 991,
      },
    ]);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      id: 'si-1',
      productName: 'Almonds Premium',
      skuCode: 'ALM-1',
      skuName: '1kg',
      quantity: 2,
      unitPrice: 500.5,
      lineTotal: 991,
    });
    expect(lines[0].unitPriceLabel).toContain('500');
    expect(lines[0].lineTotalLabel).toContain('991');
  });

  it('builds payment summary from sales totals and sales_payments', () => {
    const payment = mapSaleToPaymentSummary({
      sale: { subtotal: 1000, discount: 50, total: 950 },
      salePayment: { status: 'PAID', amount: 950, collected_at: '2026-08-21T10:00:00Z' },
      methodLabel: 'Cash on Delivery',
    });

    expect(payment).toMatchObject({
      methodLabel: 'Cash on Delivery',
      status: 'PAID',
      subtotal: 1000,
      discount: 50,
      total: 950,
      collected: 950,
      outstanding: 0,
    });
    expect(payment.totalLabel).toContain('950');
  });

  it('zeros collected when sales_payments status is REFUNDED', () => {
    const payment = mapSaleToPaymentSummary({
      sale: { subtotal: 1000, discount: 0, total: 1000 },
      salePayment: { status: 'REFUNDED', amount: 1000 },
      methodLabel: 'Cash on Delivery',
    });
    expect(payment.status).toBe('REFUNDED');
    expect(payment.collected).toBe(0);
    expect(payment.outstanding).toBe(1000);
  });
});
