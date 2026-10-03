/**
 * Phase 6 — double-entry accounting helpers (owner-facing "Books").
 * Journals are derived from domain events; operational rows are not duplicated.
 */

import { formatInr } from '@/data/live/format';

export const ACCOUNT_TYPES = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE',
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ASSET: 'Asset',
  LIABILITY: 'Liability',
  EQUITY: 'Equity',
  REVENUE: 'Income',
  EXPENSE: 'Expense',
};

export type JournalLineInput = {
  accountCode: string;
  debit: number;
  credit: number;
  memo?: string | null;
};

export type JournalBalanceResult = {
  balanced: boolean;
  totalDebit: number;
  totalCredit: number;
  difference: number;
};

function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Every journal must balance: sum(debit) === sum(credit). */
export function assertJournalBalance(
  lines: readonly JournalLineInput[],
): JournalBalanceResult {
  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of lines) {
    const debit = roundMoney(line.debit);
    const credit = roundMoney(line.credit);
    if (debit < 0 || credit < 0) {
      throw new Error('Journal amounts cannot be negative');
    }
    if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
      throw new Error('Each journal line must be debit XOR credit');
    }
    totalDebit += debit;
    totalCredit += credit;
  }
  totalDebit = roundMoney(totalDebit);
  totalCredit = roundMoney(totalCredit);
  return {
    balanced: totalDebit === totalCredit && totalDebit > 0,
    totalDebit,
    totalCredit,
    difference: roundMoney(totalDebit - totalCredit),
  };
}

export type ChartAccountRow = {
  id: string;
  code: string;
  name: string;
  accountType: AccountType;
  accountTypeLabel: string;
  isSystem: boolean;
  isActive: boolean;
};

export type JournalListRow = {
  id: string;
  entryDate: string;
  entryDateLabel: string;
  sourceType: string;
  sourceTypeLabel: string;
  sourceId: string;
  memo: string;
  totalDebit: number;
  totalDebitLabel: string;
  lineCount: number;
};

export type TrialBalanceRow = {
  accountId: string;
  code: string;
  name: string;
  accountType: AccountType;
  accountTypeLabel: string;
  debitTotal: number;
  debitTotalLabel: string;
  creditTotal: number;
  creditTotalLabel: string;
  balanceDebit: number;
  balanceCredit: number;
  balanceDebitLabel: string;
  balanceCreditLabel: string;
};

export type AccountingSnapshot = {
  generatedAtLabel: string;
  rangeLabel: string;
  accountCount: number;
  journalCount: number;
  trialBalanceBalanced: boolean;
  totalDebitsLabel: string;
  totalCreditsLabel: string;
  accounts: ChartAccountRow[];
  journals: JournalListRow[];
  trialBalance: TrialBalanceRow[];
  lastSyncLabel: string | null;
};

export const JOURNAL_SOURCE_LABELS: Record<string, string> = {
  sale: 'Sale',
  collection: 'Collection',
  purchase_receive: 'Purchase received',
  supplier_payment: 'Supplier payment',
  company_expense: 'Expense',
  payroll: 'Payroll',
  cash_transfer: 'Cash ↔ Bank transfer',
  opening_balance: 'Opening balance',
  cash_deposit: 'Deposit',
  cash_withdrawal: 'Withdrawal',
};

export function journalSourceLabel(sourceType: string): string {
  return JOURNAL_SOURCE_LABELS[sourceType] ?? sourceType;
}

export function buildTrialBalanceRows(
  accounts: readonly ChartAccountRow[],
  lines: readonly {
    accountId: string;
    debit: number;
    credit: number;
  }[],
): {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
} {
  const byAccount = new Map<string, { debit: number; credit: number }>();
  for (const line of lines) {
    const cur = byAccount.get(line.accountId) ?? { debit: 0, credit: 0 };
    cur.debit += Number(line.debit) || 0;
    cur.credit += Number(line.credit) || 0;
    byAccount.set(line.accountId, cur);
  }

  const rows: TrialBalanceRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const account of accounts) {
    const totals = byAccount.get(account.id) ?? { debit: 0, credit: 0 };
    const debitTotal = roundMoney(totals.debit);
    const creditTotal = roundMoney(totals.credit);
    const net = roundMoney(debitTotal - creditTotal);
    const balanceDebit = net > 0 ? net : 0;
    const balanceCredit = net < 0 ? roundMoney(-net) : 0;
    if (debitTotal === 0 && creditTotal === 0) continue;
    totalDebit += balanceDebit;
    totalCredit += balanceCredit;
    rows.push({
      accountId: account.id,
      code: account.code,
      name: account.name,
      accountType: account.accountType,
      accountTypeLabel: account.accountTypeLabel,
      debitTotal,
      debitTotalLabel: formatInr(debitTotal),
      creditTotal,
      creditTotalLabel: formatInr(creditTotal),
      balanceDebit,
      balanceCredit,
      balanceDebitLabel: balanceDebit > 0 ? formatInr(balanceDebit) : '—',
      balanceCreditLabel: balanceCredit > 0 ? formatInr(balanceCredit) : '—',
    });
  }

  totalDebit = roundMoney(totalDebit);
  totalCredit = roundMoney(totalCredit);
  return {
    rows,
    totalDebit,
    totalCredit,
    balanced: totalDebit === totalCredit,
  };
}

/** Example balanced sale journal used in Phase 6 docs/tests. */
export function buildSaleJournalLines(input: {
  salesTotal: number;
  cogsTotal?: number;
}): JournalLineInput[] {
  const salesTotal = roundMoney(input.salesTotal);
  const cogsTotal = roundMoney(input.cogsTotal ?? 0);
  const lines: JournalLineInput[] = [
    { accountCode: '1100', debit: salesTotal, credit: 0 },
    { accountCode: '4000', debit: 0, credit: salesTotal },
  ];
  if (cogsTotal > 0) {
    lines.push({ accountCode: '5000', debit: cogsTotal, credit: 0 });
    lines.push({ accountCode: '1200', debit: 0, credit: cogsTotal });
  }
  return lines;
}
