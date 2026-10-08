import { describe, expect, it } from 'vitest';
import {
  amountDuePreview,
  buildCounterSaleRpcArgs,
  formatCounterSaleError,
  previewCounterSaleTotals,
  validateCounterSaleDraft,
  type CounterCartLine,
} from './counter-sale';

const catalogueLine = (
  partial: Partial<Extract<CounterCartLine, { kind: 'CATALOGUE' }>> & {
    name: string;
  },
): CounterCartLine => ({
  key: '1',
  kind: 'CATALOGUE',
  skuId: 'sku-1',
  sellingUnitLabel: 'Box',
  quantity: 2,
  quantityStep: 1,
  moq: 1,
  listUnitPrice: 399,
  unitPrice: 399,
  priceOverridden: false,
  lineDiscount: 0,
  ...partial,
});

describe('counter-sale helpers', () => {
  it('previews subtotal, bill discount, and total', () => {
    const lines: CounterCartLine[] = [
      catalogueLine({ name: 'Kaju', quantity: 2, unitPrice: 500 }),
      catalogueLine({
        key: '2',
        name: 'Badam',
        quantity: 1,
        unitPrice: 1000,
      }),
    ];
    expect(previewCounterSaleTotals({ lines, billDiscount: 200 })).toEqual({
      subtotal: 2000,
      discount: 200,
      total: 1800,
    });
  });

  it('blocks amount paid greater than total', () => {
    const lines = [catalogueLine({ name: 'Kaju', quantity: 1, unitPrice: 100 })];
    expect(
      validateCounterSaleDraft({
        customer: { kind: 'walkIn' },
        lines,
        billDiscount: 0,
        paymentMethod: 'CASH',
        amountPaid: 150,
      }),
    ).toMatch(/greater than the sale total/i);
  });

  it('builds RPC payload with catalogue override + custom line', () => {
    const args = buildCounterSaleRpcArgs({
      customer: { kind: 'existing', shopId: 'shop-1', displayName: 'ABC' },
      lines: [
        catalogueLine({
          name: 'Kaju',
          quantity: 2,
          listUnitPrice: 399,
          unitPrice: 380,
          priceOverridden: true,
        }),
        {
          key: 'c1',
          kind: 'CUSTOM',
          name: 'Special Grocery Item',
          unit: 'Kg',
          quantity: 2,
          unitPrice: 180,
          lineDiscount: 10,
        },
      ],
      billDiscount: 50,
      paymentMethod: 'UPI',
      amountPaid: 500,
      clientRequestId: 'req-12345678',
    });

    expect(args.p_shop).toEqual({ shopId: 'shop-1' });
    expect(args.p_bill_discount).toBe(50);
    expect(args.p_payment).toEqual({ amountPaid: 500, method: 'UPI' });
    expect(args.p_lines[0]).toMatchObject({
      kind: 'CATALOGUE',
      skuId: 'sku-1',
      quantity: 2,
      unitPrice: 380,
    });
    expect(args.p_lines[1]).toMatchObject({
      kind: 'CUSTOM',
      name: 'Special Grocery Item',
      unit: 'Kg',
      quantity: 2,
      unitPrice: 180,
      discount: 10,
    });
  });

  it('credit sale sends zero paid', () => {
    const args = buildCounterSaleRpcArgs({
      customer: { kind: 'walkIn' },
      lines: [catalogueLine({ name: 'Kaju', quantity: 1, unitPrice: 100 })],
      billDiscount: 0,
      paymentMethod: 'CREDIT',
      amountPaid: 999,
      clientRequestId: 'req-credit-01',
    });
    expect(args.p_payment).toEqual({ amountPaid: 0, method: 'CASH' });
    expect(amountDuePreview(100, 0)).toBe(100);
  });

  it('maps insufficient stock to owner language', () => {
    expect(
      formatCounterSaleError(
        new Error('Insufficient stock for Kaju (available 3.000)'),
      ),
    ).toBe('Not enough stock for Kaju. Available: 3.000.');
  });

  it('maps network failure without clearing guidance', () => {
    expect(formatCounterSaleError(new Error('Failed to fetch'))).toMatch(
      /cart is still here/i,
    );
  });
});
