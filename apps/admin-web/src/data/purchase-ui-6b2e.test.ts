import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildPurchaseAccounting } from './purchase-accounting';
import {
  filterPurchaseRows,
  mapPurchaseItemDbRow,
  normalizePurchaseStatus,
  PURCHASE_STATUS_LABELS,
  type PurchaseListRow,
  type PurchaseStatus,
} from './purchasing';
import { isPayablePurchaseStatus } from './purchase-payable';

function listRow(
  status: PurchaseStatus,
  id = 'p1',
): PurchaseListRow {
  return {
    id,
    supplierId: 's1',
    supplierName: 'Acme',
    warehouseId: 'w1',
    warehouseName: 'Main',
    purchaseDate: '2026-10-01',
    purchaseDateLabel: '01 Oct 2026',
    billNumber: 'INV-100',
    status,
    statusLabel: PURCHASE_STATUS_LABELS[status],
    itemCount: 1,
    subtotal: 1000,
    taxAmount: 180,
    cgstAmount: 90,
    sgstAmount: 90,
    igstAmount: 0,
    supplyType: 'INTRA',
    total: 1180,
    totalLabel: '₹1,180',
  };
}

/** Mirror LiveAdminApi action flags used by PurchaseDetailPage / forms. */
function purchaseActionVisibility(input: {
  status: PurchaseStatus;
  remainingToReceive: number;
  remainingReturnable: number;
}) {
  const canEdit = input.status === 'DRAFT';
  const canCancel = input.status === 'DRAFT';
  const canReceive =
    (input.status === 'DRAFT' || input.status === 'PARTIALLY_RECEIVED') &&
    input.remainingToReceive > 0;
  const canReturn = input.remainingReturnable > 0;
  return { canEdit, canCancel, canReceive, canReturn };
}

describe('Phase 6B.2E purchase UI status and actions', () => {
  it('normalizes and labels PARTIALLY_RECEIVED', () => {
    expect(normalizePurchaseStatus('partially_received')).toBe(
      'PARTIALLY_RECEIVED',
    );
    expect(PURCHASE_STATUS_LABELS.PARTIALLY_RECEIVED).toBe(
      'Partially received',
    );
  });

  it('filters list by PARTIALLY_RECEIVED', () => {
    const rows = [
      listRow('DRAFT', 'd'),
      listRow('PARTIALLY_RECEIVED', 'p'),
      listRow('RECEIVED', 'r'),
    ];
    expect(
      filterPurchaseRows(rows, { status: 'PARTIALLY_RECEIVED' }).map((r) => r.id),
    ).toEqual(['p']);
  });

  it('exposes receive/return/edit/cancel by status', () => {
    expect(
      purchaseActionVisibility({
        status: 'DRAFT',
        remainingToReceive: 10,
        remainingReturnable: 0,
      }),
    ).toEqual({
      canEdit: true,
      canCancel: true,
      canReceive: true,
      canReturn: false,
    });

    expect(
      purchaseActionVisibility({
        status: 'PARTIALLY_RECEIVED',
        remainingToReceive: 4,
        remainingReturnable: 6,
      }),
    ).toEqual({
      canEdit: false,
      canCancel: false,
      canReceive: true,
      canReturn: true,
    });

    expect(
      purchaseActionVisibility({
        status: 'RECEIVED',
        remainingToReceive: 0,
        remainingReturnable: 10,
      }),
    ).toEqual({
      canEdit: false,
      canCancel: false,
      canReceive: false,
      canReturn: true,
    });

    expect(
      purchaseActionVisibility({
        status: 'CANCELLED',
        remainingToReceive: 10,
        remainingReturnable: 0,
      }),
    ).toEqual({
      canEdit: false,
      canCancel: false,
      canReceive: false,
      canReturn: false,
    });
  });

  it('maps line qty columns for partial receive / return history display', () => {
    const row = mapPurchaseItemDbRow(
      {
        id: 'pi-1',
        sku_id: 'sku',
        product_name: 'Rice',
        sku_code: 'RICE',
        sku_name: '1kg',
        quantity: 10,
        unit_cost: 100,
        line_total: 1000,
      },
      { receivedQuantity: 6, returnedQuantity: 2 },
    );
    expect(row.quantity).toBe(10);
    expect(row.receivedQuantity).toBe(6);
    expect(row.returnedQuantity).toBe(2);
    expect(row.remainingToReceive).toBe(4);
    expect(row.remainingReturnable).toBe(4);
  });

  it('keeps legacy full-receive display on bill-total payable path', () => {
    const accounting = buildPurchaseAccounting({
      status: 'RECEIVED',
      subtotal: 1000,
      taxAmount: 180,
      total: 1180,
      items: [{ quantity: 10, unitCost: 100, lineTotal: 1000 }],
      hasReceiptEvents: false,
      payments: [
        {
          id: 'pay1',
          amount: 1180,
          paymentDate: '2026-10-01',
          paymentMethodLabel: 'UPI',
        },
      ],
    });
    expect(accounting.path).toBe('legacy');
    expect(accounting.billTotal).toBe(1180);
    expect(accounting.payableIncrease).toBe(1180);
    expect(accounting.remainingOnBill).toBe(0);
    expect(accounting.creditOnBill).toBe(0);
    expect(isPayablePurchaseStatus('RECEIVED')).toBe(true);
  });

  it('shows supplier credit after return against a paid bill', () => {
    const accounting = buildPurchaseAccounting({
      status: 'RECEIVED',
      subtotal: 1000,
      taxAmount: 180,
      total: 1180,
      items: [{ quantity: 10, unitCost: 100, lineTotal: 1000 }],
      receiptTotal: 1180,
      returnTotal: 590,
      hasReceiptEvents: true,
      payments: [
        {
          id: 'pay1',
          amount: 1180,
          paymentDate: '2026-10-01',
          paymentMethodLabel: 'UPI',
        },
      ],
    });
    expect(accounting.receiptTotal).toBe(1180);
    expect(accounting.returnTotal).toBe(590);
    expect(accounting.creditOnBill).toBe(590);
    expect(accounting.remainingOnBill).toBe(-590);
    expect(accounting.ownerSummary.toLowerCase()).toContain('credit');
    expect(accounting.effects.some((e) => e.id === 'returns')).toBe(true);
  });

  it('keeps mobile touch targets for receive/return ops forms', () => {
    const cssPath = join(
      dirname(fileURLToPath(import.meta.url)),
      '../pages/purchases/PurchasingPages.css',
    );
    const css = readFileSync(cssPath, 'utf8');
    expect(css).toContain('.ga-purchasing__ops-form');
    expect(css).toContain('.ga-purchasing__credit');
    expect(css).toContain('min-height: 44px');
    expect(css).toContain('@media (max-width: 720px)');
  });

  it('invalidates accounting with other purchasing queries after ops', () => {
    const mutationsPath = join(
      dirname(fileURLToPath(import.meta.url)),
      'mutations.ts',
    );
    const src = readFileSync(mutationsPath, 'utf8');
    expect(src).toContain("useReceivePurchaseLinesMutation");
    expect(src).toContain("useCreatePurchaseReturnMutation");
    expect(src).toMatch(
      /invalidatePurchasingQueries[\s\S]*\['groaurum', 'accounting'\]/,
    );
    expect(src).toMatch(
      /invalidatePurchasingQueries[\s\S]*\['groaurum', 'inventory'\]/,
    );
    expect(src).toMatch(
      /invalidatePurchasingQueries[\s\S]*\['groaurum', 'payables'\]/,
    );
  });
});
