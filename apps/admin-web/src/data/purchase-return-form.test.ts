import { describe, expect, it, vi } from 'vitest';
import {
  formatPurchaseReturnError,
  nextReturnClientRequestId,
  planPurchaseReturn,
  returnSubmissionFingerprint,
} from './purchase-return-form';
import type { PurchaseItemRow } from './purchasing';

vi.mock('@/data/counter-sale', () => ({
  newClientRequestId: vi.fn(
    () => `ret-${Math.random().toString(36).slice(2, 10)}`,
  ),
}));

function item(partial: Partial<PurchaseItemRow> & { id: string }): PurchaseItemRow {
  const quantity = partial.quantity ?? 10;
  const received = partial.receivedQuantity ?? 10;
  const returned = partial.returnedQuantity ?? 0;
  const remainingReturnable =
    partial.remainingReturnable ?? Math.max(0, received - returned);
  return {
    id: partial.id,
    skuId: partial.skuId ?? 'sku-1',
    productName: partial.productName ?? 'Rice',
    skuCode: partial.skuCode ?? 'RICE',
    skuName: partial.skuName ?? '1kg',
    quantity,
    quantityLabel: String(quantity),
    unitCost: partial.unitCost ?? 100,
    unitCostLabel: '₹100',
    lineTotal: partial.lineTotal ?? quantity * 100,
    lineTotalLabel: '₹1,000',
    receivedQuantity: received,
    receivedQuantityLabel: String(received),
    returnedQuantity: returned,
    returnedQuantityLabel: String(returned),
    remainingToReceive: partial.remainingToReceive ?? 0,
    remainingToReceiveLabel: '0',
    remainingReturnable,
    remainingReturnableLabel: String(remainingReturnable),
  };
}

describe('planPurchaseReturn (Phase 6B.2E)', () => {
  const lines = [
    item({ id: 'pi-1', remainingReturnable: 10, unitCost: 100 }),
    item({
      id: 'pi-2',
      productName: 'Dal',
      remainingReturnable: 4,
      unitCost: 50,
    }),
  ];

  it('requires a reason and plans taxable/tax/total credit', () => {
    expect(
      planPurchaseReturn({
        items: lines,
        quantities: { 'pi-1': '2' },
        reason: '',
        receiptTaxable: 1200,
        receiptTax: 216,
        priorReturnTaxable: 0,
        priorReturnTax: 0,
      }).ok,
    ).toBe(false);

    const plan = planPurchaseReturn({
      items: lines,
      quantities: { 'pi-1': '5' },
      reason: 'Damaged carton',
      receiptTaxable: 1200,
      receiptTax: 216,
      priorReturnTaxable: 0,
      priorReturnTax: 0,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.reason).toBe('Damaged carton');
    expect(plan.taxableAmount).toBe(500);
    expect(plan.taxAmount).toBe(90);
    expect(plan.totalAmount).toBe(590);
    expect(plan.completesNetReceived).toBe(false);
  });

  it('rejects over-returning', () => {
    const plan = planPurchaseReturn({
      items: lines,
      quantities: { 'pi-1': '11' },
      reason: 'Too many',
      receiptTaxable: 1200,
      receiptTax: 216,
      priorReturnTaxable: 0,
      priorReturnTax: 0,
    });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.error).toMatch(/returnable/i);
  });

  it('reuses client_request_id only for identical retry after error', () => {
    const fingerprint = returnSubmissionFingerprint({
      purchaseId: 'p1',
      reason: 'Damaged',
      lines: [{ purchaseItemId: 'pi-1', quantity: 2 }],
    });
    const first = nextReturnClientRequestId({
      previousId: 'req-old',
      previousFingerprint: null,
      nextFingerprint: fingerprint,
      lastOutcome: 'none',
    });
    const retry = nextReturnClientRequestId({
      previousId: first.id,
      previousFingerprint: first.fingerprint,
      nextFingerprint: fingerprint,
      lastOutcome: 'error',
    });
    expect(retry.id).toBe(first.id);
  });

  it('maps reserved-stock, over-return, and permission errors', () => {
    expect(
      formatPurchaseReturnError(
        new Error('resulting on_hand would fall below reserved'),
      ),
    ).toMatch(/reserved/i);
    expect(
      formatPurchaseReturnError(new Error('quantity exceeds net received')),
    ).toMatch(/exceeds net received/i);
    expect(
      formatPurchaseReturnError(new Error('only admin can create returns')),
    ).toMatch(/admin permission/i);
  });
});
