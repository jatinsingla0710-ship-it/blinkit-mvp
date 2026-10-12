import { describe, expect, it, vi } from 'vitest';
import {
  defaultReceiveQuantities,
  formatPurchaseReceiveError,
  nextReceiveClientRequestId,
  planPurchaseReceive,
  receiveSubmissionFingerprint,
} from './purchase-receive-form';
import type { PurchaseItemRow } from './purchasing';

vi.mock('@/data/counter-sale', () => ({
  newClientRequestId: vi.fn(
    () => `recv-${Math.random().toString(36).slice(2, 10)}`,
  ),
}));

function item(partial: Partial<PurchaseItemRow> & { id: string }): PurchaseItemRow {
  const quantity = partial.quantity ?? 10;
  const received = partial.receivedQuantity ?? 0;
  const returned = partial.returnedQuantity ?? 0;
  const remainingToReceive =
    partial.remainingToReceive ?? Math.max(0, quantity - received);
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
    remainingToReceive,
    remainingToReceiveLabel: String(remainingToReceive),
    remainingReturnable,
    remainingReturnableLabel: String(remainingReturnable),
  };
}

describe('planPurchaseReceive (Phase 6B.2E)', () => {
  const lines = [
    item({ id: 'pi-1', quantity: 10, remainingToReceive: 10, unitCost: 100 }),
    item({
      id: 'pi-2',
      productName: 'Dal',
      quantity: 4,
      remainingToReceive: 4,
      unitCost: 50,
    }),
  ];

  it('plans a partial receipt with pro-rata tax', () => {
    const plan = planPurchaseReceive({
      items: lines,
      quantities: { 'pi-1': '5' },
      billSubtotal: 1200,
      billTax: 216,
      priorReceiptTaxable: 0,
      priorReceiptTax: 0,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.taxableAmount).toBe(500);
    expect(plan.taxAmount).toBe(90);
    expect(plan.totalAmount).toBe(590);
    expect(plan.completesBill).toBe(false);
    expect(plan.lines).toEqual([{ purchaseItemId: 'pi-1', quantity: 5 }]);
  });

  it('partial then final receive completes the bill and takes remaining tax', () => {
    const afterPartial = [
      item({
        id: 'pi-1',
        quantity: 10,
        receivedQuantity: 5,
        remainingToReceive: 5,
        unitCost: 100,
      }),
      item({
        id: 'pi-2',
        productName: 'Dal',
        quantity: 4,
        remainingToReceive: 4,
        unitCost: 50,
      }),
    ];
    const final = planPurchaseReceive({
      items: afterPartial,
      quantities: { 'pi-1': '5', 'pi-2': '4' },
      billSubtotal: 1200,
      billTax: 216,
      priorReceiptTaxable: 500,
      priorReceiptTax: 90,
    });
    expect(final.ok).toBe(true);
    if (!final.ok) return;
    expect(final.completesBill).toBe(true);
    expect(final.taxableAmount).toBe(700);
    expect(final.taxAmount).toBe(126);
    expect(final.totalAmount).toBe(826);
  });

  it('rejects over-receiving and empty lines', () => {
    expect(
      planPurchaseReceive({
        items: lines,
        quantities: { 'pi-1': '11' },
        billSubtotal: 1200,
        billTax: 0,
        priorReceiptTaxable: 0,
        priorReceiptTax: 0,
      }).ok,
    ).toBe(false);
    expect(
      planPurchaseReceive({
        items: lines,
        quantities: {},
        billSubtotal: 1200,
        billTax: 0,
        priorReceiptTaxable: 0,
        priorReceiptTax: 0,
      }).ok,
    ).toBe(false);
  });

  it('defaults receive quantities to remaining', () => {
    expect(defaultReceiveQuantities(lines)).toEqual({
      'pi-1': '10',
      'pi-2': '4',
    });
  });
});

describe('receive idempotency and errors', () => {
  it('reuses client_request_id only for identical retry after error', () => {
    const fingerprint = receiveSubmissionFingerprint({
      purchaseId: 'p1',
      lines: [{ purchaseItemId: 'pi-1', quantity: 5 }],
    });
    const first = nextReceiveClientRequestId({
      previousId: 'req-old',
      previousFingerprint: null,
      nextFingerprint: fingerprint,
      lastOutcome: 'none',
    });
    const retry = nextReceiveClientRequestId({
      previousId: first.id,
      previousFingerprint: first.fingerprint,
      nextFingerprint: fingerprint,
      lastOutcome: 'error',
    });
    expect(retry.id).toBe(first.id);

    const changed = nextReceiveClientRequestId({
      previousId: first.id,
      previousFingerprint: first.fingerprint,
      nextFingerprint: receiveSubmissionFingerprint({
        purchaseId: 'p1',
        lines: [{ purchaseItemId: 'pi-1', quantity: 6 }],
      }),
      lastOutcome: 'error',
    });
    expect(changed.id).not.toBe(first.id);

    const afterSuccess = nextReceiveClientRequestId({
      previousId: first.id,
      previousFingerprint: first.fingerprint,
      nextFingerprint: fingerprint,
      lastOutcome: 'success',
    });
    expect(afterSuccess.id).not.toBe(first.id);
  });

  it('maps over-receive, duplicate, and permission errors', () => {
    expect(
      formatPurchaseReceiveError(new Error('quantity exceeds remaining ordered')),
    ).toMatch(/exceeds remaining/i);
    expect(
      formatPurchaseReceiveError(
        new Error('client_request_id already used for a different receipt'),
      ),
    ).toMatch(/already used/i);
    expect(
      formatPurchaseReceiveError(new Error('only admin can receive')),
    ).toMatch(/admin permission/i);
  });
});
