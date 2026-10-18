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

/** Client `.limit()` on cashBankSnapshot journal_entries select (not PostgREST max_rows). */
export const CASH_BANK_JOURNAL_ENTRY_QUERY_LIMIT = 5000;

/** Client `.limit()` on cashBankSnapshot journal_lines select for tracked accounts. */
export const CASH_BANK_JOURNAL_LINE_QUERY_LIMIT = 8000;

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

export type CashBankJournalCompletenessStatus =
  | 'complete'
  | 'truncated'
  | 'unknown';

/**
 * Exact-count vs returned-row signal for Cash & Bank journal loads.
 * KPIs may still be computed from returned rows; callers must not treat
 * truncated/unknown snapshots as conclusive Books AR/AP.
 */
export type CashBankJournalCompleteness = {
  status: CashBankJournalCompletenessStatus;
  /** Exact DB count of journal_entries with entry_date <= asOfDate; null if count failed. */
  entryExactCount: number | null;
  /** Rows returned by the existing journal_entries select. */
  entryReturnedCount: number;
  entryQueryLimit: number;
  /**
   * Exact count of tracked-account journal_lines for the returned entry ids;
   * null if count failed. Truncation here can understate AR/AP balances.
   */
  lineExactCount: number | null;
  /** Rows returned by the existing journal_lines select. */
  lineReturnedCount: number;
  lineQueryLimit: number;
  reason: string | null;
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
  journalCompleteness: CashBankJournalCompleteness;
};

export function buildCashBankHonestyNote(hasLedgerActivity: boolean): string {
  if (!hasLedgerActivity) {
    return 'No posted cash or bank journals yet. Update Books for business activity, or enter a verified opening balance — balances are never invented.';
  }
  return 'Cash and bank balances come from posted Books journals only.';
}

/**
 * Compare exact PostgREST counts to rows actually returned.
 * Never assumes completeness when a count is missing or inconsistent.
 */
export function resolveCashBankJournalCompleteness(input: {
  entryExactCount: number | null;
  entryReturnedCount: number;
  entryQueryLimit?: number;
  lineExactCount: number | null;
  lineReturnedCount: number;
  lineQueryLimit?: number;
}): CashBankJournalCompleteness {
  const entryQueryLimit =
    input.entryQueryLimit ?? CASH_BANK_JOURNAL_ENTRY_QUERY_LIMIT;
  const lineQueryLimit =
    input.lineQueryLimit ?? CASH_BANK_JOURNAL_LINE_QUERY_LIMIT;
  const base = {
    entryExactCount: input.entryExactCount,
    entryReturnedCount: input.entryReturnedCount,
    entryQueryLimit,
    lineExactCount: input.lineExactCount,
    lineReturnedCount: input.lineReturnedCount,
    lineQueryLimit,
  };

  if (input.entryExactCount === null || input.lineExactCount === null) {
    return {
      ...base,
      status: 'unknown',
      reason:
        'Could not establish exact journal entry or line counts; Books completeness is inconclusive.',
    };
  }

  if (
    input.entryExactCount < input.entryReturnedCount ||
    input.lineExactCount < input.lineReturnedCount
  ) {
    return {
      ...base,
      status: 'unknown',
      reason:
        'Exact journal counts are lower than returned rows; Books completeness is inconclusive.',
    };
  }

  const entryTruncated = input.entryExactCount > input.entryReturnedCount;
  const lineTruncated = input.lineExactCount > input.lineReturnedCount;
  if (entryTruncated || lineTruncated) {
    const parts: string[] = [];
    if (entryTruncated) {
      parts.push(
        `journal entries truncated (${input.entryReturnedCount} of ${input.entryExactCount})`,
      );
    }
    if (lineTruncated) {
      parts.push(
        `tracked journal lines truncated (${input.lineReturnedCount} of ${input.lineExactCount})`,
      );
    }
    return {
      ...base,
      status: 'truncated',
      reason: `Cash & Bank journal load is incomplete: ${parts.join('; ')}.`,
    };
  }

  return {
    ...base,
    status: 'complete',
    reason: null,
  };
}

export function emptyCashBankJournalCompleteness(): CashBankJournalCompleteness {
  return resolveCashBankJournalCompleteness({
    entryExactCount: 0,
    entryReturnedCount: 0,
    lineExactCount: 0,
    lineReturnedCount: 0,
  });
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
