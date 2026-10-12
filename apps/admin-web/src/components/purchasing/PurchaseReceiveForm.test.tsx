import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PurchaseReceiveForm } from './PurchaseReceiveForm';
import { buildPurchaseAccounting } from '@/data/purchase-accounting';
import type { PurchaseDetail } from '@/data/purchasing';

const mutateLines = vi.fn();
const mutateAll = vi.fn();
let linesPending = false;
let allPending = false;

vi.mock('@/data/mutations', () => ({
  useReceivePurchaseLinesMutation: () => ({
    mutateAsync: mutateLines,
    isPending: linesPending,
  }),
  useReceivePurchaseMutation: () => ({
    mutateAsync: mutateAll,
    isPending: allPending,
  }),
}));

vi.mock('@/data/counter-sale', () => ({
  newClientRequestId: () => 'req-fixed',
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
      receivedQuantity: 0,
      receivedQuantityLabel: '0',
      returnedQuantity: 0,
      returnedQuantityLabel: '0',
      remainingToReceive: 10,
      remainingToReceiveLabel: '10',
      remainingReturnable: 0,
      remainingReturnableLabel: '0',
    },
  ];
  const accounting = buildPurchaseAccounting({
    status: 'DRAFT',
    subtotal: 1000,
    taxAmount: 180,
    total: 1180,
    items: [{ quantity: 10, unitCost: 100, lineTotal: 1000 }],
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
    status: 'DRAFT',
    statusLabel: 'Draft',
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
    receivedAtLabel: null,
    firstReceivedAtLabel: null,
    items,
    subtotalLabel: '₹1,000',
    taxAmountLabel: '₹180',
    canEdit: true,
    canReceive: true,
    canReturn: false,
    accounting,
    billPayments: [],
    receiptHistory: [],
    returnHistory: [],
    receiptTaxableAmount: 0,
    receiptTaxAmount: 0,
    returnTaxableAmount: 0,
    returnTaxAmount: 0,
    ...overrides,
  };
}

describe('PurchaseReceiveForm (Phase 6B.2E)', () => {
  beforeEach(() => {
    mutateLines.mockReset();
    mutateAll.mockReset();
    linesPending = false;
    allPending = false;
  });

  it('renders receive actions for receivable drafts', () => {
    const html = renderToStaticMarkup(
      <PurchaseReceiveForm
        purchase={detail()}
        onDone={() => undefined}
        onError={() => undefined}
      />,
    );
    expect(html).toContain('Receive stock');
    expect(html).toContain('Receive all remaining');
    expect(html).toContain('Receive partial');
    expect(html).toContain('ga-purchasing__receive');
  });

  it('hides when nothing remains to receive', () => {
    const html = renderToStaticMarkup(
      <PurchaseReceiveForm
        purchase={detail({
          canReceive: false,
          status: 'RECEIVED',
          items: [
            {
              ...detail().items[0]!,
              remainingToReceive: 0,
              remainingToReceiveLabel: '0',
              receivedQuantity: 10,
            },
          ],
        })}
        onDone={() => undefined}
        onError={() => undefined}
      />,
    );
    expect(html).toBe('');
  });

  it('disables actions while mutation is pending', () => {
    allPending = true;
    const html = renderToStaticMarkup(
      <PurchaseReceiveForm
        purchase={detail()}
        onDone={() => undefined}
        onError={() => undefined}
      />,
    );
    expect(html).toContain('Receiving…');
    expect(html).toMatch(/disabled/);
  });

  it('exposes mobile-friendly quantity inputs and receipt preview when expanded', () => {
    const html = renderToStaticMarkup(
      <PurchaseReceiveForm
        purchase={detail()}
        defaultExpanded
        onDone={() => undefined}
        onError={() => undefined}
      />,
    );
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain('type="number"');
    expect(html).toContain('ga-purchasing__ops-form');
    expect(html).toContain('Receipt taxable');
    expect(html).toContain('Allocated tax');
    expect(html).toContain('Receipt total');
    expect(html).toContain('Confirm receive');
    expect(html).toContain('aria-label="Receive quantity for Rice"');
  });
});
