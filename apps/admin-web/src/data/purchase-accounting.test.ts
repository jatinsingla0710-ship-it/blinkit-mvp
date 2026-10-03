import { describe, expect, it } from 'vitest';
import { buildPurchaseAccounting } from './purchase-accounting';

describe('Phase 3 purchase accounting', () => {
  it('treats received inventory purchases as payable, not expense', () => {
    const accounting = buildPurchaseAccounting({
      status: 'RECEIVED',
      subtotal: 100000,
      taxAmount: 5000,
      total: 105000,
      items: [
        { quantity: 100, unitCost: 800, lineTotal: 80000 },
        { quantity: 50, unitCost: 400, lineTotal: 20000 },
      ],
      payments: [
        {
          id: 'pay1',
          amount: 40000,
          paymentDate: '2026-10-03',
          paymentMethodLabel: 'UPI',
        },
      ],
    });

    expect(accounting.isExpense).toBe(false);
    expect(accounting.isInventoryPurchase).toBe(true);
    expect(accounting.inventoryQuantity).toBe(150);
    expect(accounting.inventoryCost).toBe(100000);
    expect(accounting.payableIncrease).toBe(105000);
    expect(accounting.taxAmount).toBe(5000);
    expect(accounting.paidAgainstBill).toBe(40000);
    expect(accounting.remainingOnBill).toBe(65000);
    expect(accounting.effects.map((e) => e.id)).toEqual([
      'inventory',
      'payable',
      'not_expense',
      'payments',
    ]);
    expect(accounting.ownerSummary).toContain('65,000');
  });

  it('keeps drafts and cancelled bills off the books', () => {
    const draft = buildPurchaseAccounting({
      status: 'DRAFT',
      subtotal: 1000,
      taxAmount: 0,
      total: 1000,
      items: [{ quantity: 10, unitCost: 100, lineTotal: 1000 }],
    });
    expect(draft.payableIncrease).toBe(0);
    expect(draft.remainingOnBill).toBe(0);
    expect(draft.effects[0]?.id).toBe('draft');

    const cancelled = buildPurchaseAccounting({
      status: 'CANCELLED',
      subtotal: 1000,
      taxAmount: 0,
      total: 1000,
      items: [{ quantity: 10, unitCost: 100, lineTotal: 1000 }],
    });
    expect(cancelled.payableIncrease).toBe(0);
    expect(cancelled.effects[0]?.id).toBe('cancelled');
  });
});
