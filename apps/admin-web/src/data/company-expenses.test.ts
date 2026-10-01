import { describe, expect, it } from 'vitest';
import {
  buildCompanyExpensesSnapshot,
  expenseAmountError,
  filterCompanyExpenseRows,
  mapCompanyExpenseRow,
  todayExpenseDate,
  validateCompanyExpenseInput,
} from './company-expenses';

describe('company expenses', () => {
  it('rejects invalid amounts and empty description', () => {
    expect(expenseAmountError(0)).toMatch(/greater than 0/i);
    expect(expenseAmountError(-5)).toMatch(/greater than 0/i);
    expect(
      validateCompanyExpenseInput({
        expenseDate: '2026-09-30',
        category: 'TRANSPORT',
        amount: 100,
        description: '   ',
        paymentMethod: 'CASH',
      }),
    ).toMatch(/description/i);
  });

  it('accepts a valid expense', () => {
    expect(
      validateCompanyExpenseInput({
        expenseDate: todayExpenseDate(),
        category: 'FUEL' as never,
        amount: 800,
        description: 'Fuel',
        paymentMethod: 'CASH',
      }),
    ).toMatch(/category/i);

    expect(
      validateCompanyExpenseInput({
        expenseDate: '2026-09-30',
        category: 'TRANSPORT',
        amount: 800,
        description: 'Fuel',
        paymentMethod: 'CASH',
      }),
    ).toBeNull();
  });

  it('builds month/today/cash/bank summaries', () => {
    const rows = [
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
      mapCompanyExpenseRow({
        id: 'e2',
        expense_date: '2026-09-01',
        category: 'RENT',
        amount: 10000,
        description: 'Shop rent',
        payment_method: 'BANK',
        created_at: '2026-09-01T10:00:00.000Z',
        updated_at: '2026-09-01T10:00:00.000Z',
      }),
      mapCompanyExpenseRow({
        id: 'e3',
        expense_date: '2026-08-15',
        category: 'UTILITIES',
        amount: 500,
        description: 'Power',
        payment_method: 'UPI',
        created_at: '2026-08-15T10:00:00.000Z',
        updated_at: '2026-08-15T10:00:00.000Z',
      }),
    ];

    const snapshot = buildCompanyExpensesSnapshot({
      generatedAtIso: '2026-09-30T12:00:00.000Z',
      rows,
      todayYmd: '2026-09-30',
    });

    expect(snapshot.todayTotal).toBe(800);
    expect(snapshot.thisMonthTotal).toBe(10800);
    expect(snapshot.cashTotal).toBe(800);
    expect(snapshot.bankUpiTotal).toBe(10500);
    expect(filterCompanyExpenseRows(rows, 'fuel')).toHaveLength(1);
  });
});
