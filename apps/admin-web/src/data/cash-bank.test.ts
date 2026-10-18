import { describe, expect, it } from 'vitest';
import {
  CASH_BANK_JOURNAL_ENTRY_QUERY_LIMIT,
  CASH_BANK_JOURNAL_LINE_QUERY_LIMIT,
  attachRunningBalances,
  buildCashToBankTransferLines,
  buildOpeningBalanceLines,
  buildCashBankHonestyNote,
  emptyCashBankJournalCompleteness,
  ledgerAssetBalance,
  ledgerLiabilityBalance,
  resolveCashBankJournalCompleteness,
} from './cash-bank';

describe('Phase 7 cash & bank', () => {
  it('computes cash/bank asset balances and payable liability balances', () => {
    expect(ledgerAssetBalance(10000, 2500)).toBe(7500);
    expect(ledgerLiabilityBalance(4000, 10000)).toBe(6000);
  });

  it('builds balanced transfer and opening journals', () => {
    expect(buildCashToBankTransferLines(1500)).toEqual([
      { accountCode: '1010', debit: 1500, credit: 0 },
      { accountCode: '1000', debit: 0, credit: 1500 },
    ]);
    expect(buildOpeningBalanceLines({ cashAmount: 2000, bankAmount: 8000 })).toEqual([
      { accountCode: '1000', debit: 2000, credit: 0 },
      { accountCode: '1010', debit: 8000, credit: 0 },
      { accountCode: '3000', debit: 0, credit: 10000 },
    ]);
  });

  it('refuses invented empty openings and explains empty ledger honesty', () => {
    expect(() => buildOpeningBalanceLines({})).toThrow(/verified opening/i);
    expect(buildCashBankHonestyNote(false)).toMatch(/never invented/i);
    expect(buildCashBankHonestyNote(true)).toMatch(/posted Books journals/i);
  });

  it('attaches running balances oldest-to-newest then returns newest-first', () => {
    const rows = attachRunningBalances(
      [
        {
          id: '1',
          entryDate: '2026-10-01',
          entryDateLabel: '01 Oct 2026',
          accountCode: '1000',
          accountLabel: 'Cash',
          sourceType: 'opening_balance',
          sourceTypeLabel: 'Opening',
          memo: 'Open',
          debit: 1000,
          credit: 0,
          amountLabel: '₹1,000',
        },
        {
          id: '2',
          entryDate: '2026-10-02',
          entryDateLabel: '02 Oct 2026',
          accountCode: '1000',
          accountLabel: 'Cash',
          sourceType: 'cash_transfer',
          sourceTypeLabel: 'Transfer',
          memo: 'To bank',
          debit: 0,
          credit: 400,
          amountLabel: '₹400',
        },
      ],
      0,
    );
    expect(rows[0]?.id).toBe('2');
    expect(rows[0]?.runningBalance).toBe(600);
    expect(rows[1]?.runningBalance).toBe(1000);
  });

  it('marks journal completeness complete when exact counts match returned rows', () => {
    const result = resolveCashBankJournalCompleteness({
      entryExactCount: 12,
      entryReturnedCount: 12,
      lineExactCount: 40,
      lineReturnedCount: 40,
    });
    expect(result.status).toBe('complete');
    expect(result.reason).toBeNull();
    expect(result.entryQueryLimit).toBe(CASH_BANK_JOURNAL_ENTRY_QUERY_LIMIT);
    expect(result.lineQueryLimit).toBe(CASH_BANK_JOURNAL_LINE_QUERY_LIMIT);
    expect(emptyCashBankJournalCompleteness().status).toBe('complete');
  });

  it('marks truncated when exact entry or line counts exceed returned rows', () => {
    // PostgREST max_rows can return far fewer than the client .limit(5000).
    const entryTruncated = resolveCashBankJournalCompleteness({
      entryExactCount: 2500,
      entryReturnedCount: 1000,
      lineExactCount: 3200,
      lineReturnedCount: 3200,
    });
    expect(entryTruncated.status).toBe('truncated');
    expect(entryTruncated.reason).toMatch(/journal entries truncated/i);
    expect(entryTruncated.reason).toMatch(/1000 of 2500/);

    const lineTruncated = resolveCashBankJournalCompleteness({
      entryExactCount: 500,
      entryReturnedCount: 500,
      lineExactCount: 9000,
      lineReturnedCount: 8000,
    });
    expect(lineTruncated.status).toBe('truncated');
    expect(lineTruncated.reason).toMatch(/tracked journal lines truncated/i);
    expect(lineTruncated.reason).toMatch(/8000 of 9000/);
  });

  it('marks unknown when exact counts fail or are inconsistent with returned rows', () => {
    const entryCountFailed = resolveCashBankJournalCompleteness({
      entryExactCount: null,
      entryReturnedCount: 10,
      lineExactCount: 20,
      lineReturnedCount: 20,
    });
    expect(entryCountFailed.status).toBe('unknown');
    expect(entryCountFailed.reason).toMatch(/inconclusive/i);
    expect(entryCountFailed.entryExactCount).toBeNull();

    const lineCountFailed = resolveCashBankJournalCompleteness({
      entryExactCount: 10,
      entryReturnedCount: 10,
      lineExactCount: null,
      lineReturnedCount: 20,
    });
    expect(lineCountFailed.status).toBe('unknown');
    expect(lineCountFailed.lineExactCount).toBeNull();

    const inconsistent = resolveCashBankJournalCompleteness({
      entryExactCount: 5,
      entryReturnedCount: 10,
      lineExactCount: 20,
      lineReturnedCount: 20,
    });
    expect(inconsistent.status).toBe('unknown');
    expect(inconsistent.reason).toMatch(/lower than returned rows/i);
  });
});
