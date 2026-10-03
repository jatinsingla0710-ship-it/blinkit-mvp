import { describe, expect, it } from 'vitest';
import {
  buildSupplierLedger,
  buildSupplierPayablesSnapshot,
  filterPayableRows,
  isPayablePurchase,
} from './supplier-ledger';

describe('Phase 2 supplier payables ledger', () => {
  it('counts only RECEIVED purchases as payable', () => {
    expect(isPayablePurchase('RECEIVED')).toBe(true);
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
    expect(ledger.outstandingLabel).toContain('60,000');
    expect(ledger.entries).toHaveLength(2);
    expect(ledger.entries[0]?.type).toBe('payment');
    expect(ledger.entries[1]?.type).toBe('purchase');
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
        },
      ],
      payments: [],
    });

    expect(snapshot.rows).toHaveLength(1);
    expect(snapshot.totalOutstanding).toBe(1000);
    expect(snapshot.suppliersWithDues).toBe(1);
    expect(snapshot.rows[0]?.oldestOpenDays).toBe(2);
    expect(snapshot.rows[0]?.ageingBucket).toBe('days_1_30');
    expect(filterPayableRows(snapshot.rows, 'acme', 'outstanding')).toHaveLength(
      1,
    );
    expect(filterPayableRows(snapshot.rows, '', 'paid')).toHaveLength(0);
  });
});
