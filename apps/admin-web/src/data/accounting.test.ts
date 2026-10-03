import { describe, expect, it } from 'vitest';
import {
  assertJournalBalance,
  buildSaleJournalLines,
  buildTrialBalanceRows,
  type ChartAccountRow,
} from './accounting';

describe('Phase 6 double-entry accounting', () => {
  it('requires balanced sale journals (AR/Sales + optional COGS)', () => {
    const lines = buildSaleJournalLines({
      salesTotal: 500000,
      cogsTotal: 350000,
    });
    const balance = assertJournalBalance(lines);
    expect(balance.balanced).toBe(true);
    expect(balance.totalDebit).toBe(850000);
    expect(balance.totalCredit).toBe(850000);
  });

  it('rejects unbalanced journals', () => {
    expect(() =>
      assertJournalBalance([
        { accountCode: '1100', debit: 100, credit: 0 },
        { accountCode: '4000', debit: 0, credit: 90 },
      ]),
    ).not.toThrow();
    const unbalanced = assertJournalBalance([
      { accountCode: '1100', debit: 100, credit: 0 },
      { accountCode: '4000', debit: 0, credit: 90 },
    ]);
    expect(unbalanced.balanced).toBe(false);
    expect(unbalanced.difference).toBe(10);
  });

  it('builds a balanced trial balance from journal lines', () => {
    const accounts: ChartAccountRow[] = [
      {
        id: 'a1',
        code: '1100',
        name: 'Money Due',
        accountType: 'ASSET',
        accountTypeLabel: 'Asset',
        isSystem: true,
        isActive: true,
      },
      {
        id: 'a2',
        code: '4000',
        name: 'Sales',
        accountType: 'REVENUE',
        accountTypeLabel: 'Income',
        isSystem: true,
        isActive: true,
      },
    ];
    const tb = buildTrialBalanceRows(accounts, [
      { accountId: 'a1', debit: 1000, credit: 0 },
      { accountId: 'a2', debit: 0, credit: 1000 },
    ]);
    expect(tb.balanced).toBe(true);
    expect(tb.totalDebit).toBe(1000);
    expect(tb.totalCredit).toBe(1000);
    expect(tb.rows).toHaveLength(2);
  });
});
