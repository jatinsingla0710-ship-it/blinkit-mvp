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
    expect(cf.investing).toBe(0);
    expect(cf.financing).toBe(2000);
    expect(cf.closingCashBank).toBe(16000);

    const gl = buildGeneralLedgerRows(period, (d) => d, '1000');
    expect(gl).toHaveLength(2);
    expect(gl.every((row) => row.accountCode === '1000')).toBe(true);
  });

  it('classifies customer collections and refunds as operating cash flow', () => {
    const period = [
      line({
        accountCode: '1000',
        accountType: 'ASSET',
        debit: 7000,
        credit: 0,
        sourceType: 'customer_collection',
        journalId: 'cc1',
      }),
      line({
        accountCode: '1100',
        accountType: 'ASSET',
        debit: 0,
        credit: 7000,
        sourceType: 'customer_collection',
        journalId: 'cc1',
      }),
      line({
        accountCode: '1010',
        accountType: 'ASSET',
        debit: 0,
        credit: 2500,
        sourceType: 'collection_refund',
        journalId: 'cr1',
      }),
      line({
        accountCode: '1100',
        accountType: 'ASSET',
        debit: 2500,
        credit: 0,
        sourceType: 'collection_refund',
        journalId: 'cr1',
      }),
      line({
        accountCode: '1000',
        accountType: 'ASSET',
        debit: 1500,
        credit: 0,
        sourceType: 'collection_event',
        journalId: 'ce1',
      }),
      line({
        accountCode: '1100',
        accountType: 'ASSET',
        debit: 0,
        credit: 1500,
        sourceType: 'collection_event',
        journalId: 'ce1',
      }),
    ];
    const cf = buildCashFlowStatement({
      openingCashBank: 10000,
      periodLines: period,
    });
    // customer_collection +7000, collection_event +1500, collection_refund −2500
    expect(cf.operating).toBe(6000);
    expect(cf.investing).toBe(0);
    expect(cf.financing).toBe(0);
    expect(cf.netChange).toBe(6000);
    expect(cf.closingCashBank).toBe(16000);
  });

  it('classifies supplier payment and reversal with correct operating signs', () => {
    const period = [
      line({
        accountCode: '2000',
        accountType: 'LIABILITY',
        debit: 4000,
        credit: 0,
        sourceType: 'supplier_payment',
        journalId: 'sp1',
      }),
      line({
        accountCode: '1010',
        accountType: 'ASSET',
        debit: 0,
        credit: 4000,
        sourceType: 'supplier_payment',
        journalId: 'sp1',
      }),
      line({
        accountCode: '1010',
        accountType: 'ASSET',
        debit: 4000,
        credit: 0,
        sourceType: 'supplier_payment_reversal',
        journalId: 'spr1',
      }),
      line({
        accountCode: '2000',
        accountType: 'LIABILITY',
        debit: 0,
        credit: 4000,
        sourceType: 'supplier_payment_reversal',
        journalId: 'spr1',
      }),
    ];
    const cf = buildCashFlowStatement({
      openingCashBank: 20000,
      periodLines: period,
    });
    // −4000 payment +4000 reversal → operating nets to zero (both operating)
    expect(cf.operating).toBe(0);
    expect(cf.investing).toBe(0);
    expect(cf.financing).toBe(0);
    expect(cf.closingCashBank).toBe(20000);

    const paymentOnly = buildCashFlowStatement({
      openingCashBank: 20000,
      periodLines: period.filter((l) => l.sourceType === 'supplier_payment'),
    });
    expect(paymentOnly.operating).toBe(-4000);
    expect(paymentOnly.investing).toBe(0);

    const reversalOnly = buildCashFlowStatement({
      openingCashBank: 20000,
      periodLines: period.filter(
        (l) => l.sourceType === 'supplier_payment_reversal',
      ),
    });
    expect(reversalOnly.operating).toBe(4000);
    expect(reversalOnly.investing).toBe(0);
  });

  it('keeps sale_refund cash legs in operating when present', () => {
    // Typical sale_refund has no cash; if a cash leg exists it must not dump to investing.
    const period = [
      line({
        accountCode: '1000',
        accountType: 'ASSET',
        debit: 0,
        credit: 500,
        sourceType: 'sale_refund',
        journalId: 'sr1',
      }),
    ];
    const cf = buildCashFlowStatement({
      openingCashBank: 5000,
      periodLines: period,
    });
    expect(cf.operating).toBe(-500);
    expect(cf.investing).toBe(0);
    expect(cf.financing).toBe(0);
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
