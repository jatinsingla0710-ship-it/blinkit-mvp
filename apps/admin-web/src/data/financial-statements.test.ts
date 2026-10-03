import { describe, expect, it } from 'vitest';
import type { LedgerLineFact } from './financial-statements';
import {
  buildBalanceSheet,
  buildCashFlowStatement,
  buildGeneralLedgerRows,
  buildLedgerProfitLoss,
  buildLedgerTrialBalance,
  cashBankBalanceFromLines,
} from './financial-statements';

function line(
  partial: Partial<LedgerLineFact> &
    Pick<
      LedgerLineFact,
      'accountCode' | 'accountType' | 'debit' | 'credit' | 'sourceType'
    >,
): LedgerLineFact {
  return {
    accountId: partial.accountId ?? partial.accountCode,
    accountName: partial.accountName ?? partial.accountCode,
    journalId: partial.journalId ?? 'j1',
    entryDate: partial.entryDate ?? '2026-10-01',
    memo: partial.memo ?? 'Test',
    ...partial,
  };
}

describe('Phase 8 ledger financial statements', () => {
  it('builds P&L with gross and net profit from journal facts', () => {
    const pl = buildLedgerProfitLoss([
      line({
        accountCode: '4000',
        accountType: 'REVENUE',
        debit: 0,
        credit: 500000,
        sourceType: 'sale',
      }),
      line({
        accountCode: '5000',
        accountType: 'EXPENSE',
        debit: 350000,
        credit: 0,
        sourceType: 'sale',
      }),
      line({
        accountCode: '5100',
        accountType: 'EXPENSE',
        debit: 20000,
        credit: 0,
        sourceType: 'company_expense',
      }),
      line({
        accountCode: '5200',
        accountType: 'EXPENSE',
        debit: 30000,
        credit: 0,
        sourceType: 'payroll',
      }),
    ]);
    expect(pl.revenue).toBe(500000);
    expect(pl.cogs).toBe(350000);
    expect(pl.grossProfit).toBe(150000);
    expect(pl.grossMarginPercent).toBe(30);
    expect(pl.netProfit).toBe(100000);
  });

  it('builds a balanced balance sheet with retained earnings', () => {
    const bs = buildBalanceSheet(
      [
        line({
          accountCode: '1000',
          accountType: 'ASSET',
          debit: 40000,
          credit: 0,
          sourceType: 'opening_balance',
        }),
        line({
          accountCode: '1100',
          accountType: 'ASSET',
          debit: 100000,
          credit: 0,
          sourceType: 'sale',
        }),
        line({
          accountCode: '2000',
          accountType: 'LIABILITY',
          debit: 0,
          credit: 25000,
          sourceType: 'purchase_receive',
        }),
        line({
          accountCode: '3000',
          accountType: 'EQUITY',
          debit: 0,
          credit: 40000,
          sourceType: 'opening_balance',
        }),
        line({
          accountCode: '4000',
          accountType: 'REVENUE',
          debit: 0,
          credit: 100000,
          sourceType: 'sale',
        }),
        line({
          accountCode: '5000',
          accountType: 'EXPENSE',
          debit: 25000,
          credit: 0,
          sourceType: 'sale',
        }),
      ],
      '2026-10-31',
    );
    expect(bs.assetsTotal).toBe(140000);
    expect(bs.liabilitiesTotal).toBe(25000);
    expect(bs.retainedEarnings).toBe(75000);
    expect(bs.equityTotal).toBe(115000);
    expect(bs.balanced).toBe(true);
  });

  it('classifies cash flow and builds general ledger rows', () => {
    const period = [
      line({
        accountCode: '1000',
        accountType: 'ASSET',
        debit: 5000,
        credit: 0,
        sourceType: 'collection',
        journalId: 'a',
      }),
      line({
        accountCode: '1000',
        accountType: 'ASSET',
        debit: 0,
        credit: 1000,
        sourceType: 'company_expense',
        journalId: 'b',
      }),
      line({
        accountCode: '1010',
        accountType: 'ASSET',
        debit: 2000,
        credit: 0,
        sourceType: 'cash_deposit',
        journalId: 'c',
      }),
    ];
    const cf = buildCashFlowStatement({
      openingCashBank: 10000,
      periodLines: period,
    });
    expect(cf.operating).toBe(4000);
    expect(cf.financing).toBe(2000);
    expect(cf.closingCashBank).toBe(16000);

    const gl = buildGeneralLedgerRows(period, (d) => d, '1000');
    expect(gl).toHaveLength(2);
    expect(gl.every((row) => row.accountCode === '1000')).toBe(true);
  });

  it('builds trial balance and opening cash from ledger facts', () => {
    const facts = [
      line({
        accountCode: '1000',
        accountType: 'ASSET',
        debit: 10000,
        credit: 0,
        sourceType: 'opening_balance',
        entryDate: '2026-09-30',
      }),
      line({
        accountCode: '3000',
        accountType: 'EQUITY',
        debit: 0,
        credit: 10000,
        sourceType: 'opening_balance',
        entryDate: '2026-09-30',
      }),
      line({
        accountCode: '4000',
        accountType: 'REVENUE',
        debit: 0,
        credit: 5000,
        sourceType: 'sale',
        entryDate: '2026-10-01',
      }),
      line({
        accountCode: '1100',
        accountType: 'ASSET',
        debit: 5000,
        credit: 0,
        sourceType: 'sale',
        entryDate: '2026-10-01',
      }),
    ];
    expect(cashBankBalanceFromLines(facts.filter((f) => f.entryDate < '2026-10-01'))).toBe(
      10000,
    );
    const tb = buildLedgerTrialBalance(facts);
    expect(tb.balanced).toBe(true);
    expect(tb.totalDebit).toBe(tb.totalCredit);
  });
});
