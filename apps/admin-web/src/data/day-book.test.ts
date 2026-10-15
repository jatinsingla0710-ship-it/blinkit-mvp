import { describe, expect, it } from 'vitest';
import { mapCompanyExpenseRow } from './company-expenses';
import {
  buildDayBookEntries,
  buildDayBookSnapshot,
  exportDayBookCsv,
  filterDayBookEntries,
  shopCollectionPaymentMethodLabel,
  summarizeDayBook,
} from './day-book';
import { summarizeDayBookByType } from './financial-reports';

const orders = [
  {
    id: 'o1',
    status: 'DELIVERED',
    total: 5000,
    created_at: '2026-09-30T08:00:00.000Z',
    order_code: 'GA-1',
    shop_name: 'ABC Store',
  },
  {
    id: 'o2',
    status: 'DELIVERED',
    total: 3500,
    created_at: '2026-09-30T09:00:00.000Z',
    order_code: 'GA-2',
    shop_name: 'XYZ Store',
  },
  {
    id: 'o3',
    status: 'CANCELLED',
    total: 9000,
    created_at: '2026-09-30T07:00:00.000Z',
    order_code: 'GA-3',
    shop_name: 'Gone',
  },
];

describe('day book', () => {
  it('shows paid sale once and collection for partial without duplicating', () => {
    const entries = buildDayBookEntries({
      orders,
      payments: [
        {
          id: 'p1',
          order_id: 'o1',
          status: 'PAYMENT_PENDING',
          amount: 5000,
          cash_collected_amount: 2000,
          online_collected_amount: 0,
          paid_at: '2026-09-30T11:00:00.000Z',
          method_label: 'UPI',
        },
        {
          id: 'p2',
          order_id: 'o2',
          status: 'PAID',
          amount: 3500,
          cash_collected_amount: 3500,
          paid_at: '2026-09-30T12:00:00.000Z',
          method_label: 'Cash',
        },
      ],
      expenses: [
        mapCompanyExpenseRow({
          id: 'e1',
          expense_date: '2026-09-30',
          category: 'TRANSPORT',
          amount: 800,
          description: 'Fuel',
          payment_method: 'CASH',
          created_at: '2026-09-30T10:00:00.000Z',
          updated_at: '2026-09-30T10:00:00.000Z',
        }),
      ],
    });

    expect(entries.map((e) => e.type).sort()).toEqual([
      'collection',
      'expense',
      'sale',
    ]);
    expect(entries.find((e) => e.type === 'collection')?.moneyIn).toBe(2000);
    expect(entries.find((e) => e.type === 'sale')?.moneyIn).toBe(3500);
    expect(entries.find((e) => e.type === 'expense')?.moneyOut).toBe(800);
    expect(entries.some((e) => e.description.includes('Gone'))).toBe(false);

    // Same PAID payment must not also emit Collection.
    expect(
      entries.filter((e) => e.type === 'collection' && e.partyLabel === 'XYZ Store'),
    ).toHaveLength(0);

    const totals = summarizeDayBook(entries);
    expect(totals.moneyIn).toBe(5500);
    expect(totals.moneyOut).toBe(800);
    expect(totals.net).toBe(4700);
  });

  it('includes refunds as money out', () => {
    const entries = buildDayBookEntries({
      orders: [orders[0]!],
      payments: [
        {
          id: 'p1',
          order_id: 'o1',
          status: 'REFUNDED',
          amount: 5000,
          paid_at: '2026-09-30T15:00:00.000Z',
          method_label: 'UPI',
        },
      ],
      expenses: [],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.type).toBe('refund');
    expect(entries[0]?.moneyOut).toBe(5000);
  });

  it('filters by date, type, and payment method', () => {
    const snapshot = buildDayBookSnapshot({
      generatedAtIso: '2026-09-30T18:00:00.000Z',
      dateFrom: '2026-09-30',
      dateTo: '2026-09-30',
      orders,
      payments: [
        {
          id: 'p2',
          order_id: 'o2',
          status: 'PAID',
          amount: 3500,
          cash_collected_amount: 3500,
          paid_at: '2026-09-30T12:00:00.000Z',
          method_label: 'Cash',
        },
      ],
      expenses: [
        mapCompanyExpenseRow({
          id: 'e1',
          expense_date: '2026-09-29',
          category: 'RENT',
          amount: 1000,
          description: 'Rent',
          payment_method: 'BANK',
          created_at: '2026-09-29T10:00:00.000Z',
          updated_at: '2026-09-29T10:00:00.000Z',
        }),
      ],
      type: 'sale',
      paymentMethod: 'Cash',
    });

    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0]?.type).toBe('sale');
    expect(snapshot.moneyIn).toBe(3500);

    const all = buildDayBookEntries({
      orders,
      payments: [
        {
          id: 'p2',
          order_id: 'o2',
          status: 'PAID',
          amount: 3500,
          cash_collected_amount: 3500,
          paid_at: '2026-09-30T12:00:00.000Z',
          method_label: 'Cash',
        },
      ],
      expenses: [
        mapCompanyExpenseRow({
          id: 'e1',
          expense_date: '2026-09-30',
          category: 'TRANSPORT',
          amount: 100,
          description: 'Fuel',
          payment_method: 'CASH',
          created_at: '2026-09-30T10:00:00.000Z',
          updated_at: '2026-09-30T10:00:00.000Z',
        }),
      ],
    });
    expect(filterDayBookEntries(all, { type: 'expense' })).toHaveLength(1);
    expect(exportDayBookCsv(all)).toContain('Money In');
    expect(exportDayBookCsv(all)).toContain('Fuel');
  });

  it('includes paid payroll once as money out and skips unpaid', () => {
    const entries = buildDayBookEntries({
      orders: [],
      payments: [],
      expenses: [],
      paidPayroll: [
        {
          id: 'pr1',
          salesmanId: 's1',
          salesmanName: 'Ravi',
          payrollMonth: '2026-09-01',
          totalAmount: 25000,
          paidAt: '2026-09-30T14:00:00.000Z',
          paymentMethodLabel: 'Bank',
        },
      ],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.type).toBe('payroll');
    expect(entries[0]?.moneyOut).toBe(25000);
    expect(entries[0]?.description).toContain('Ravi');
    expect(entries.filter((e) => e.id === 'payroll-pr1')).toHaveLength(1);

    const empty = buildDayBookEntries({
      orders: [],
      payments: [],
      expenses: [],
      paidPayroll: [],
    });
    expect(empty.some((e) => e.type === 'payroll')).toBe(false);
  });

  it('maps shop collection methods to Day Book payment labels', () => {
    expect(shopCollectionPaymentMethodLabel('CASH')).toBe('Cash');
    expect(shopCollectionPaymentMethodLabel('UPI')).toBe('UPI');
    expect(shopCollectionPaymentMethodLabel('BANK')).toBe('Bank');
    expect(shopCollectionPaymentMethodLabel('CARD')).toBe('Other');
    expect(shopCollectionPaymentMethodLabel(null)).toBe('—');
  });

  it('includes customer cash collection once in money-in on the collection date', () => {
    const entries = buildDayBookEntries({
      orders: [],
      payments: [],
      expenses: [],
      shopCollections: [
        {
          id: 'sc-cash',
          shopId: 'shop-1',
          shopName: 'ABC Store',
          amount: 7000,
          method: 'CASH',
          note: null,
          atIso: '2026-10-15T10:30:00.000Z',
        },
      ],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe('shop-collection-sc-cash');
    expect(entries[0]?.type).toBe('collection');
    expect(entries[0]?.moneyIn).toBe(7000);
    expect(entries[0]?.moneyOut).toBe(0);
    expect(entries[0]?.paymentMethod).toBe('Cash');
    expect(entries[0]?.partyLabel).toBe('ABC Store');
    expect(entries[0]?.href).toBe('/customers/shop-1');
    expect(summarizeDayBook(entries).moneyIn).toBe(7000);
    expect(summarizeDayBookByType(entries).collectionsIn).toBe(7000);

    const snapshot = buildDayBookSnapshot({
      generatedAtIso: '2026-10-15T18:00:00.000Z',
      dateFrom: '2026-10-15',
      dateTo: '2026-10-15',
      orders: [],
      payments: [],
      expenses: [],
      shopCollections: [
        {
          id: 'sc-cash',
          shopId: 'shop-1',
          shopName: 'ABC Store',
          amount: 7000,
          method: 'CASH',
          atIso: '2026-10-15T10:30:00.000Z',
        },
      ],
    });
    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.moneyIn).toBe(7000);
  });

  it('classifies bank and UPI customer collections for payment-method filters', () => {
    const entries = buildDayBookEntries({
      orders: [],
      payments: [],
      expenses: [],
      shopCollections: [
        {
          id: 'sc-upi',
          shopId: 'shop-1',
          shopName: 'ABC Store',
          amount: 3000,
          method: 'UPI',
          atIso: '2026-10-15T11:00:00.000Z',
        },
        {
          id: 'sc-bank',
          shopId: 'shop-2',
          shopName: 'XYZ Store',
          amount: 4500,
          method: 'BANK',
          note: 'NEFT',
          atIso: '2026-10-15T12:00:00.000Z',
        },
      ],
    });

    expect(entries.find((e) => e.id === 'shop-collection-sc-upi')?.paymentMethod).toBe(
      'UPI',
    );
    expect(entries.find((e) => e.id === 'shop-collection-sc-bank')?.paymentMethod).toBe(
      'Bank',
    );
    expect(
      entries.find((e) => e.id === 'shop-collection-sc-bank')?.description,
    ).toContain('NEFT');

    expect(filterDayBookEntries(entries, { paymentMethod: 'UPI' })).toHaveLength(1);
    expect(filterDayBookEntries(entries, { paymentMethod: 'Bank' })).toHaveLength(1);
    expect(filterDayBookEntries(entries, { type: 'collection' })).toHaveLength(2);
  });

  it('aggregates multiple customer collections without duplicating order collections', () => {
    const entries = buildDayBookEntries({
      orders: [orders[0]!],
      payments: [
        {
          id: 'p1',
          order_id: 'o1',
          status: 'PAYMENT_PENDING',
          amount: 5000,
          cash_collected_amount: 2000,
          online_collected_amount: 0,
          paid_at: '2026-10-15T09:00:00.000Z',
          method_label: 'Cash',
        },
      ],
      expenses: [],
      shopCollections: [
        {
          id: 'sc-1',
          shopId: 'shop-1',
          shopName: 'ABC Store',
          amount: 1000,
          method: 'CASH',
          atIso: '2026-10-15T10:00:00.000Z',
        },
        {
          id: 'sc-2',
          shopId: 'shop-1',
          shopName: 'ABC Store',
          amount: 2500,
          method: 'UPI',
          atIso: '2026-10-15T11:00:00.000Z',
        },
        {
          id: 'sc-zero',
          shopId: 'shop-1',
          shopName: 'ABC Store',
          amount: 0,
          method: 'CASH',
          atIso: '2026-10-15T12:00:00.000Z',
        },
      ],
    });

    const shopCollectionEntries = entries.filter((e) =>
      e.id.startsWith('shop-collection-'),
    );
    expect(shopCollectionEntries).toHaveLength(2);
    expect(entries.filter((e) => e.type === 'collection')).toHaveLength(3);
    expect(entries.filter((e) => e.id === 'collection-p1')).toHaveLength(1);
    expect(summarizeDayBook(entries).moneyIn).toBe(5500);
    expect(summarizeDayBookByType(entries).collectionsIn).toBe(5500);
  });

  it('keeps sales, expenses, and supplier payments alongside shop collections', () => {
    const entries = buildDayBookEntries({
      orders: [orders[1]!],
      payments: [
        {
          id: 'p2',
          order_id: 'o2',
          status: 'PAID',
          amount: 3500,
          cash_collected_amount: 3500,
          paid_at: '2026-10-15T12:00:00.000Z',
          method_label: 'Cash',
        },
      ],
      expenses: [
        mapCompanyExpenseRow({
          id: 'e1',
          expense_date: '2026-10-15',
          category: 'TRANSPORT',
          amount: 500,
          description: 'Fuel',
          payment_method: 'CASH',
          created_at: '2026-10-15T10:00:00.000Z',
          updated_at: '2026-10-15T10:00:00.000Z',
        }),
      ],
      supplierPayments: [
        {
          id: 'sp1',
          supplierId: 'sup-1',
          purchaseId: null,
          paymentDate: '2026-10-15',
          amount: 1200,
          paymentMethod: 'UPI',
          referenceNumber: null,
          notes: null,
          createdAt: '2026-10-15T13:00:00.000Z',
          supplierName: 'Vendor Co',
        },
      ],
      shopCollections: [
        {
          id: 'sc-1',
          shopId: 'shop-x',
          shopName: 'Corner Mart',
          amount: 800,
          method: 'BANK',
          atIso: '2026-10-15T14:00:00.000Z',
        },
      ],
    });

    expect(entries.map((e) => e.type).sort()).toEqual([
      'collection',
      'expense',
      'sale',
      'supplier_payment',
    ]);
    const totals = summarizeDayBook(entries);
    expect(totals.moneyIn).toBe(4300);
    expect(totals.moneyOut).toBe(1700);
    expect(totals.net).toBe(2600);
  });

  it('date-filters shop collections and ignores rows not passed by the loader', () => {
    const all = buildDayBookEntries({
      orders: [],
      payments: [],
      expenses: [],
      shopCollections: [
        {
          id: 'sc-in',
          shopId: 'shop-1',
          shopName: 'ABC Store',
          amount: 1000,
          method: 'CASH',
          atIso: '2026-10-15T10:00:00.000Z',
        },
        {
          id: 'sc-out',
          shopId: 'shop-1',
          shopName: 'ABC Store',
          amount: 9999,
          method: 'CASH',
          atIso: '2026-10-14T10:00:00.000Z',
        },
      ],
    });

    const filtered = filterDayBookEntries(all, {
      dateFrom: '2026-10-15',
      dateTo: '2026-10-15',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('shop-collection-sc-in');
    expect(summarizeDayBook(filtered).moneyIn).toBe(1000);

    // Soft-deleted collections are excluded by the live loader (deleted_at IS NULL),
    // not invented as reversals here — omitted rows simply do not appear.
    const withoutDeleted = buildDayBookEntries({
      orders: [],
      payments: [],
      expenses: [],
      shopCollections: [
        {
          id: 'sc-active',
          shopId: 'shop-1',
          shopName: 'ABC Store',
          amount: 400,
          method: 'CASH',
          atIso: '2026-10-15T10:00:00.000Z',
        },
      ],
    });
    expect(withoutDeleted.map((e) => e.id)).toEqual([
      'shop-collection-sc-active',
    ]);
  });
});
