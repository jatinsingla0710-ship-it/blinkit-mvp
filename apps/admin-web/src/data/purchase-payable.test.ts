import { describe, expect, it } from 'vitest';
import {
  aggregatePayableEventTotals,
  computePurchasePayableAmounts,
  isPayablePurchaseStatus,
} from './purchase-payable';

describe('Phase 6B.2D purchase payable basis', () => {
  it('draft and cancelled have no payable basis', () => {
    expect(
      computePurchasePayableAmounts({
        status: 'DRAFT',
        billTotal: 1000,
        hasReceiptEvents: false,
      }).payableBasis,
    ).toBe(0);
    expect(
      computePurchasePayableAmounts({
        status: 'CANCELLED',
        billTotal: 1000,
        hasReceiptEvents: false,
      }).path,
    ).toBe('none');
  });

  it('partial receipt creates payable only for received value', () => {
    const amounts = computePurchasePayableAmounts({
      status: 'PARTIALLY_RECEIVED',
      billTotal: 1180,
      receiptTotal: 590,
      returnTotal: 0,
      hasReceiptEvents: true,
    });
    expect(amounts.path).toBe('receipt_events');
    expect(amounts.billTotal).toBe(1180);
    expect(amounts.payableBasis).toBe(590);
    expect(amounts.remaining).toBe(590);
  });

  it('multiple receipts reconcile toward bill total; returns reduce payable', () => {
    const afterReceipts = computePurchasePayableAmounts({
      status: 'RECEIVED',
      billTotal: 1180,
      receiptTotal: 1180,
      returnTotal: 0,
      hasReceiptEvents: true,
    });
    expect(afterReceipts.payableBasis).toBe(1180);

    const afterReturn = computePurchasePayableAmounts({
      status: 'RECEIVED',
      billTotal: 1180,
      receiptTotal: 1180,
      returnTotal: 236,
      hasReceiptEvents: true,
      linkedPayments: 0,
    });
    expect(afterReturn.payableBasis).toBe(944);
    expect(afterReturn.remaining).toBe(944);
  });

  it('payment then return creates explicit supplier credit', () => {
    const amounts = computePurchasePayableAmounts({
      status: 'RECEIVED',
      billTotal: 1180,
      receiptTotal: 1180,
      returnTotal: 590,
      hasReceiptEvents: true,
      linkedPayments: 1180,
    });
    expect(amounts.payableBasis).toBe(590);
    expect(amounts.remaining).toBe(-590);
    expect(amounts.creditOnBill).toBe(590);
  });

  it('overpayment without return is also supplier credit', () => {
    const amounts = computePurchasePayableAmounts({
      status: 'PARTIALLY_RECEIVED',
      billTotal: 1000,
      receiptTotal: 400,
      returnTotal: 0,
      hasReceiptEvents: true,
      linkedPayments: 500,
    });
    expect(amounts.remaining).toBe(-100);
    expect(amounts.creditOnBill).toBe(100);
  });

  it('legacy RECEIVED without receipt events uses bill total', () => {
    const amounts = computePurchasePayableAmounts({
      status: 'RECEIVED',
      billTotal: 2500,
      hasReceiptEvents: false,
    });
    expect(amounts.path).toBe('legacy');
    expect(amounts.payableBasis).toBe(2500);
  });

  it('aggregates receipt and return totals by purchase', () => {
    const map = aggregatePayableEventTotals(
      [
        { purchaseId: 'p1', totalAmount: 100 },
        { purchaseId: 'p1', totalAmount: 50 },
        { purchaseId: 'p2', totalAmount: 200 },
      ],
      [{ purchaseId: 'p1', totalAmount: 40 }],
    );
    expect(map.get('p1')).toEqual({
      receiptTotal: 150,
      returnTotal: 40,
      hasReceiptEvents: true,
    });
    expect(map.get('p2')?.hasReceiptEvents).toBe(true);
    expect(isPayablePurchaseStatus('PARTIALLY_RECEIVED')).toBe(true);
  });
});
