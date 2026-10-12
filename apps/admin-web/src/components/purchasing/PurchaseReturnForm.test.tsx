import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PurchaseReturnForm } from './PurchaseReturnForm';
import { buildPurchaseAccounting } from '@/data/purchase-accounting';
import type { PurchaseDetail } from '@/data/purchasing';

const mutateAsync = vi.fn();
let isPending = false;

vi.mock('@/data/mutations', () => ({
  useCreatePurchaseReturnMutation: () => ({
    mutateAsync,
    isPending,
  }),
}));

vi.mock('@/data/counter-sale', () => ({
  newClientRequestId: () => 'req-return',
}));

function detail(overrides?: Partial<PurchaseDetail>): PurchaseDetail {
  const items = [
    {
      id: 'pi-1',
      skuId: 'sku-1',
      productName: 'Rice',
      skuCode: 'RICE',
      skuName: '1kg',
      quantity: 10,
      quantityLabel: '10',
      unitCost: 100,
      unitCostLabel: '₹100',
      lineTotal: 1000,
      lineTotalLabel: '₹1,000',
      receivedQuantity: 10,
      receivedQuantityLabel: '10',
      returnedQuantity: 0,
      returnedQuantityLabel: '0',
      remainingToReceive: 0,
      remainingToReceiveLabel: '0',
      remainingReturnable: 10,
      remainingReturnableLabel: '10',
    },
  ];
  const accounting = buildPurchaseAccounting({
    status: 'RECEIVED',
    subtotal: 1000,
    taxAmount: 180,
    total: 1180,
    items: [{ quantity: 10, unitCost: 100, lineTotal: 1000 }],
    receiptTotal: 1180,
    returnTotal: 0,
    hasReceiptEvents: true,
  });
  return {
    id: 'p1',
    supplierId: 's1',
    supplierName: 'Acme',
    warehouseId: 'w1',
    warehouseName: 'Main',
    purchaseDate: '2026-10-01',
    purchaseDateLabel: '01 Oct 2026',
    billNumber: 'INV-100',
    status: 'RECEIVED',
    statusLabel: 'Received',
    itemCount: 1,
    subtotal: 1000,
    taxAmount: 180,
    cgstAmount: 90,
    sgstAmount: 90,
    igstAmount: 0,
    supplyType: 'INTRA',
    total: 1180,
    totalLabel: '₹1,180',
    notes: null,
    receivedAtLabel: '01 Oct 2026, 10:00',
    firstReceivedAtLabel: '01 Oct 2026, 10:00',
    items,
    subtotalLabel: '₹1,000',
    taxAmountLabel: '₹180',
    canEdit: false,
    canReceive: false,
    canReturn: true,
    accounting,
    billPayments: [],
    receiptHistory: [
      {
        id: 'rcpt-1',
        receivedAt: '2026-10-01T10:00:00Z',
        receivedAtLabel: '01 Oct 2026, 10:00',
        actorLabel: 'Owner',
        taxableAmount: 1000,
        taxableAmountLabel: '₹1,000',
        taxAmount: 180,
        taxAmountLabel: '₹180',
        totalAmount: 1180,
        totalAmountLabel: '₹1,180',
        lines: [
          {
            purchaseItemId: 'pi-1',
            productName: 'Rice',
            quantity: 10,
            quantityLabel: '10',
            unitCostLabel: '₹100',
            lineTaxableLabel: '₹1,000',
          },
        ],
      },
    ],
    returnHistory: [],
    receiptTaxableAmount: 1000,
    receiptTaxAmount: 180,
    returnTaxableAmount: 0,
    returnTaxAmount: 0,
    ...overrides,
  };
}

describe('PurchaseReturnForm (Phase 6B.2E)', () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    isPending = false;
  });

  it('renders return action when net received exists', () => {
    const html = renderToStaticMarkup(
      <PurchaseReturnForm
        purchase={detail()}
        onDone={() => undefined}
        onError={() => undefined}
      />,
    );
    expect(html).toContain('Return to supplier');
    expect(html).toContain('Return stock');
    expect(html).toContain('No cash/bank refund');
    expect(html).toContain('ga-purchasing__return');
  });

  it('hides when nothing is returnable', () => {
    const html = renderToStaticMarkup(
      <PurchaseReturnForm
        purchase={detail({
          canReturn: false,
          items: [
            {
              ...detail().items[0]!,
              remainingReturnable: 0,
              remainingReturnableLabel: '0',
            },
          ],
        })}
        onDone={() => undefined}
        onError={() => undefined}
      />,
    );
    expect(html).toBe('');
  });

  it('disables while mutation is pending', () => {
    isPending = true;
    const html = renderToStaticMarkup(
      <PurchaseReturnForm
        purchase={detail()}
        onDone={() => undefined}
        onError={() => undefined}
      />,
    );
    expect(html).toMatch(/disabled/);
  });

  it('exposes reason, returnable qty, and confirm action when expanded', () => {
    const html = renderToStaticMarkup(
      <PurchaseReturnForm
        purchase={detail()}
        defaultExpanded
        onDone={() => undefined}
        onError={() => undefined}
      />,
    );
    expect(html).toContain('Return reason (required)');
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain('ga-purchasing__ops-form');
    expect(html).toContain('Returnable');
    expect(html).toContain('Confirm return');
    expect(html).toContain('aria-label="Return quantity for Rice"');
    expect(html).toContain('Return reason is required');
  });
});
