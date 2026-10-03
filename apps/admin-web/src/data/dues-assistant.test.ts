import { describe, expect, it } from 'vitest';
import {
  buildDuesAssistantSnapshot,
  getDuesAnswer,
} from './dues-assistant';
import type { ReceivablesSnapshot } from './customer-ledger';
import type { SupplierPayablesSnapshot } from './supplier-ledger';
import { buildSupplierPayablesSnapshot } from './supplier-ledger';

function receivablesFixture(): ReceivablesSnapshot {
  return {
    generatedAtLabel: '2 Oct 2026',
    totalOutstanding: 15000,
    totalOutstandingLabel: '₹15,000.00',
    ageingTotals: {
      current: 0,
      days_1_30: 5000,
      days_31_60: 0,
      days_61_plus: 10000,
    },
    rows: [
      {
        customerId: 'c-fresh',
        shopName: 'Fresh Mart',
        phoneLabel: '900',
        areaLabel: 'North',
        totalSales: 5000,
        totalSalesLabel: '₹5,000.00',
        totalPaid: 0,
        totalPaidLabel: '₹0.00',
        outstanding: 5000,
        outstandingLabel: '₹5,000.00',
        lastPaymentAtLabel: null,
        oldestOpenDays: 10,
        ageingBucket: 'days_1_30',
        ageingLabel: '1–30 days',
        ledgerHref: '/customers/c-fresh',
        collectHref: '/customers/c-fresh?collect=1',
      },
      {
        customerId: 'c-stale',
        shopName: 'Stale Store',
        phoneLabel: '901',
        areaLabel: 'South',
        totalSales: 10000,
        totalSalesLabel: '₹10,000.00',
        totalPaid: 0,
        totalPaidLabel: '₹0.00',
        outstanding: 10000,
        outstandingLabel: '₹10,000.00',
        lastPaymentAtLabel: null,
        oldestOpenDays: 92,
        ageingBucket: 'days_61_plus',
        ageingLabel: '61+ days',
        ledgerHref: '/customers/c-stale',
        collectHref: null,
      },
      {
        customerId: 'c-paid',
        shopName: 'Paid Up',
        phoneLabel: '902',
        areaLabel: 'East',
        totalSales: 2000,
        totalSalesLabel: '₹2,000.00',
        totalPaid: 2000,
        totalPaidLabel: '₹2,000.00',
        outstanding: 0,
        outstandingLabel: '₹0.00',
        lastPaymentAtLabel: '1 Oct 2026',
        oldestOpenDays: null,
        ageingBucket: 'none',
        ageingLabel: 'Paid up',
        ledgerHref: '/customers/c-paid',
        collectHref: null,
      },
    ],
  };
}

describe('Phase 17 dues assistant', () => {
  it('ranks who-owes-me by age then amount, and flags stale customers', () => {
    const payables = buildSupplierPayablesSnapshot({
      generatedAtIso: '2026-10-02T12:00:00.000Z',
      suppliers: [
        { id: 's1', name: 'Acme Oils', contactPerson: 'Ravi', mobileLabel: '999' },
      ],
      purchases: [
        {
          id: 'p1',
          supplierId: 's1',
          billNumber: 'B-1',
          status: 'RECEIVED',
          total: 8000,
          purchaseDate: '2026-07-01',
        },
      ],
      payments: [],
    });

    const snapshot = buildDuesAssistantSnapshot({
      generatedAtIso: '2026-10-02T12:00:00.000Z',
      receivables: receivablesFixture(),
      payables,
    });

    expect(snapshot.customersWithDues).toBe(2);
    expect(snapshot.suppliersWithDues).toBe(1);

    const who = getDuesAnswer(snapshot, 'who_owes_me');
    expect(who.rows.map((r) => r.id)).toEqual(['c-stale', 'c-fresh']);
    expect(who.honestyNote).toMatch(/not AI prediction/i);

    const stale = getDuesAnswer(snapshot, 'stale_customers');
    expect(stale.rows).toHaveLength(1);
    expect(stale.rows[0]?.id).toBe('c-stale');

    const owe = getDuesAnswer(snapshot, 'whom_do_i_owe');
    expect(owe.rows).toHaveLength(1);
    expect(owe.rows[0]?.kind).toBe('supplier');
    expect(owe.rows[0]?.ageDays).toBeGreaterThanOrEqual(61);

    const biggest = getDuesAnswer(snapshot, 'biggest_balances');
    expect(biggest.rows[0]?.outstanding).toBe(10000);
    expect(biggest.rows.map((r) => r.kind)).toContain('supplier');
  });

  it('returns empty answers when books are clear', () => {
    const emptyReceivables: ReceivablesSnapshot = {
      generatedAtLabel: '2 Oct 2026',
      totalOutstanding: 0,
      totalOutstandingLabel: '₹0.00',
      ageingTotals: {
        current: 0,
        days_1_30: 0,
        days_31_60: 0,
        days_61_plus: 0,
      },
      rows: [],
    };
    const emptyPayables: SupplierPayablesSnapshot = {
      generatedAtLabel: '2 Oct 2026',
      rows: [],
      totalOutstanding: 0,
      totalOutstandingLabel: '₹0.00',
      suppliersWithDues: 0,
    };
    const snapshot = buildDuesAssistantSnapshot({
      generatedAtIso: '2026-10-02T12:00:00.000Z',
      receivables: emptyReceivables,
      payables: emptyPayables,
    });
    expect(getDuesAnswer(snapshot, 'who_owes_me').rows).toEqual([]);
    expect(getDuesAnswer(snapshot, 'whom_do_i_owe').rows).toEqual([]);
    expect(getDuesAnswer(snapshot, 'biggest_balances').rows).toEqual([]);
  });
});
