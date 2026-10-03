import { describe, expect, it } from 'vitest';
import {
  attachRunningBalances,
  buildCashToBankTransferLines,
  buildOpeningBalanceLines,
  buildCashBankHonestyNote,
  ledgerAssetBalance,
  ledgerLiabilityBalance,
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
});
