import { describe, expect, it } from 'vitest';
import {
  buildSupplierLedger,
  buildSupplierPayablesSnapshot,
  filterPayableRows,
  isPayablePurchase,
} from './supplier-ledger';

describe('Phase 2 / 6B.2D supplier payables ledger', () => {
  it('counts RECEIVED purchases as payable; drafts stay off the books', () => {
    expect(isPayablePurchase('RECEIVED')).toBe(true);
    expect(isPayablePurchase('PARTIALLY_RECEIVED')).toBe(true);
    expect(isPayablePurchase('DRAFT')).toBe(false);
    expect(isPayablePurchase('CANCELLED')).toBe(false);

    const ledger = buildSupplierLedger({
      supplierId: 's1',
      purchases: [
        {
          id: 'p1',
          supplierId: 's1',
          billNumber: 'B-1',
          status: 'RECEIVED',
          total: 100000,
          purchaseDate: '2026-10-01',
          hasReceiptEvents: false,
        },
        {
          id: 'p2',
          supplierId: 's1',
          billNumber: 'B-2',
          status: 'DRAFT',
          total: 50000,
          purchaseDate: '2026-10-02',
        },
      ],
      payments: [
        {
          id: 'pay1',
          supplierId: 's1',
          paymentDate: '2026-10-03',
          amount: 40000,
          paymentMethod: 'UPI',
          referenceNumber: 'UTR-1',
        },
      ],
    });

    expect(ledger.totalPurchases).toBe(100000);
    expect(ledger.totalPaid).toBe(40000);
    expect(ledger.outstanding).toBe(60000);
    expect(ledger.supplierCredit).toBe(0);
    expect(ledger.outstandingLabel).toContain('60,000');
    expect(ledger.entries).toHaveLength(2);
    expect(ledger.entries[0]?.type).toBe('payment');
    expect(ledger.entries[1]?.type).toBe('purchase');
  });

  it('uses receipt basis for partial receipts and credits returns', () => {
    const ledger = buildSupplierLedger({
      supplierId: 's1',
      purchases: [
        {
          id: 'p1',
          supplierId: 's1',
          billNumber: 'B-partial',
          status: 'PARTIALLY_RECEIVED',
          total: 1180,
          purchaseDate: '2026-10-01',
          hasReceiptEvents: true,
          receiptTotal: 590,
          returnTotal: 118,
        },
      ],
      payments: [
        {
          id: 'pay1',
          supplierId: 's1',
          purchaseId: 'p1',
          paymentDate: '2026-10-02',
          amount: 200,
          paymentMethod: 'CASH',
        },
      ],
    });

    expect(ledger.totalPurchases).toBe(590);
    expect(ledger.outstanding).toBe(590 - 118 - 200);
    expect(ledger.entries.some((e) => e.type === 'return')).toBe(true);
  });

  it('treats overpayment as supplier credit without inventing a refund', () => {
    const ledger = buildSupplierLedger({
      supplierId: 's1',
      purchases: [
        {
          id: 'p1',
          supplierId: 's1',
          billNumber: 'B-1',
          status: 'RECEIVED',
          total: 100,
          purchaseDate: '2026-10-01',
          hasReceiptEvents: true,
          receiptTotal: 100,
          returnTotal: 0,
        },
      ],
      payments: [
        {
          id: 'pay1',
          supplierId: 's1',
          amount: 150,
          paymentDate: '2026-10-02',
          paymentMethod: 'BANK',
        },
      ],
    });
    expect(ledger.outstanding).toBe(-50);
    expect(ledger.supplierCredit).toBe(50);
  });

  it('builds payables snapshot and filters dues for the owner list', () => {
    const snapshot = buildSupplierPayablesSnapshot({
      generatedAtIso: '2026-10-02T12:00:00.000Z',
      suppliers: [
        { id: 's1', name: 'Acme Oils', contactPerson: 'Ravi', mobileLabel: '999' },
        { id: 's2', name: 'Quiet Vendor' },
      ],
      purchases: [
        {
          id: 'p1',
          supplierId: 's1',
          billNumber: 'B-1',
          status: 'RECEIVED',
          total: 1000,
          purchaseDate: '2026-09-30',
          hasReceiptEvents: false,
        },
      ],
      payments: [],
    });

    expect(snapshot.rows).toHaveLength(1);
    expect(snapshot.totalOutstanding).toBe(1000);
    expect(snapshot.totalSupplierCredit).toBe(0);
    expect(snapshot.suppliersWithDues).toBe(1);
    expect(snapshot.rows[0]?.oldestOpenDays).toBe(2);
    expect(snapshot.rows[0]?.ageingBucket).toBe('days_1_30');
    expect(filterPayableRows(snapshot.rows, 'acme', 'outstanding')).toHaveLength(
      1,
    );
    expect(filterPayableRows(snapshot.rows, '', 'paid')).toHaveLength(0);
  });
});
