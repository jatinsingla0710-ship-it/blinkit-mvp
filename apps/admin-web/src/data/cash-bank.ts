/**
 * Phase 7 — Cash & Bank helpers.
 * Balances are computed only from posted journal lines (never invented).
 */

import { formatInr } from '@/data/live/format';
import { assertJournalBalance, type JournalLineInput } from '@/data/accounting';

export const CASH_ACCOUNT_CODE = '1000';
export const BANK_ACCOUNT_CODE = '1010';
export const AR_ACCOUNT_CODE = '1100';
export const AP_ACCOUNT_CODE = '2000';
export const EQUITY_ACCOUNT_CODE = '3000';

export type CashBankAccountKind = 'cash' | 'bank';

export type CashBankTransferDirection = 'cash_to_bank' | 'bank_to_cash';

export type CashBankExternalKind = 'deposit' | 'withdrawal';

function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Asset-style balance: debits − credits. */
export function ledgerAssetBalance(debitTotal: number, creditTotal: number): number {
  return roundMoney((Number(debitTotal) || 0) - (Number(creditTotal) || 0));
}

/** Liability-style balance: credits − debits. */
export function ledgerLiabilityBalance(
  debitTotal: number,
  creditTotal: number,
): number {
  return roundMoney((Number(creditTotal) || 0) - (Number(debitTotal) || 0));
}

export function buildCashToBankTransferLines(amount: number): JournalLineInput[] {
  const value = roundMoney(amount);
  const lines = [
    { accountCode: BANK_ACCOUNT_CODE, debit: value, credit: 0 },
    { accountCode: CASH_ACCOUNT_CODE, debit: 0, credit: value },
  ];
  const balance = assertJournalBalance(lines);
  if (!balance.balanced) throw new Error('Transfer journal must balance');
  return lines;
}

export function buildBankToCashTransferLines(amount: number): JournalLineInput[] {
  const value = roundMoney(amount);
  const lines = [
    { accountCode: CASH_ACCOUNT_CODE, debit: value, credit: 0 },
    { accountCode: BANK_ACCOUNT_CODE, debit: 0, credit: value },
  ];
  const balance = assertJournalBalance(lines);
  if (!balance.balanced) throw new Error('Transfer journal must balance');
  return lines;
}

export function buildOpeningBalanceLines(input: {
  cashAmount?: number;
  bankAmount?: number;
}): JournalLineInput[] {
  const cash = roundMoney(input.cashAmount ?? 0);
  const bank = roundMoney(input.bankAmount ?? 0);
  if (cash < 0 || bank < 0) throw new Error('Opening amounts cannot be negative');
  const total = roundMoney(cash + bank);
  if (total <= 0) throw new Error('Enter at least one verified opening amount');
  const lines: JournalLineInput[] = [];
  if (cash > 0) {
    lines.push({ accountCode: CASH_ACCOUNT_CODE, debit: cash, credit: 0 });
  }
  if (bank > 0) {
    lines.push({ accountCode: BANK_ACCOUNT_CODE, debit: bank, credit: 0 });
  }
  lines.push({ accountCode: EQUITY_ACCOUNT_CODE, debit: 0, credit: total });
  const balance = assertJournalBalance(lines);
  if (!balance.balanced) throw new Error('Opening journal must balance');
  return lines;
}

export type CashBankMovementRow = {
  id: string;
  entryDate: string;
  entryDateLabel: string;
  accountCode: string;
  accountLabel: string;
  sourceType: string;
  sourceTypeLabel: string;
  memo: string;
  debit: number;
  credit: number;
  amountLabel: string;
  runningBalance: number;
  runningBalanceLabel: string;
};

export type CashBankSnapshot = {
  generatedAtLabel: string;
  asOfDate: string;
  asOfDateLabel: string;
  cashBalance: number;
  cashBalanceLabel: string;
  bankBalance: number;
  bankBalanceLabel: string;
  moneyExpected: number;
  moneyExpectedLabel: string;
  moneyToPay: number;
  moneyToPayLabel: string;
  hasLedgerActivity: boolean;
  honestyNote: string;
  movements: CashBankMovementRow[];
};

export function buildCashBankHonestyNote(hasLedgerActivity: boolean): string {
  if (!hasLedgerActivity) {
    return 'No posted cash or bank journals yet. Update Books for business activity, or enter a verified opening balance — balances are never invented.';
  }
  return 'Cash and bank balances come from posted Books journals only.';
}

export function attachRunningBalances(
  rows: Array<Omit<CashBankMovementRow, 'runningBalance' | 'runningBalanceLabel'>>,
  openingBalance: number,
): CashBankMovementRow[] {
  // rows expected oldest → newest for running calc; return newest-first for UI.
  let running = roundMoney(openingBalance);
  const withRunning = rows.map((row) => {
    running = roundMoney(running + row.debit - row.credit);
    return {
      ...row,
      runningBalance: running,
      runningBalanceLabel: formatInr(running),
    };
  });
  return withRunning.reverse();
}
