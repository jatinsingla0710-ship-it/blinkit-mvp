import { describe, expect, it } from 'vitest';
import { mapCompanyExpenseRow } from './company-expenses';
import {
  buildDayBookEntries,
  buildDayBookSnapshot,
  exportDayBookCsv,
  filterDayBookEntries,
  summarizeDayBook,
} from './day-book';

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
});
