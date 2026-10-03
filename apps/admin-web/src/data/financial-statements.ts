/**
 * Phase 8 — financial statements from the Books journal ledger.
 * One source of truth: chart_of_accounts + journal_entries + journal_lines.
 */

import { formatInr } from '@/data/live/format';
import type { AccountType } from '@/data/accounting';
import { CASH_ACCOUNT_CODE, BANK_ACCOUNT_CODE } from '@/data/cash-bank';

function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export type LedgerLineFact = {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  journalId: string;
  entryDate: string;
  sourceType: string;
  memo: string;
  debit: number;
  credit: number;
};

export type StatementLine = {
  id: string;
  label: string;
  amount: number;
  amountLabel: string;
  emphasis?: boolean;
};

function naturalBalance(
  accountType: AccountType,
  debit: number,
  credit: number,
): number {
  const d = Number(debit) || 0;
  const c = Number(credit) || 0;
  if (accountType === 'ASSET' || accountType === 'EXPENSE') {
    return roundMoney(d - c);
  }
  return roundMoney(c - d);
}

function totalsByAccount(lines: readonly LedgerLineFact[]) {
  const map = new Map<
    string,
    {
      accountId: string;
      accountCode: string;
      accountName: string;
      accountType: AccountType;
      debit: number;
      credit: number;
    }
  >();
  for (const line of lines) {
    const cur = map.get(line.accountId) ?? {
      accountId: line.accountId,
      accountCode: line.accountCode,
      accountName: line.accountName,
      accountType: line.accountType,
      debit: 0,
      credit: 0,
    };
    cur.debit += Number(line.debit) || 0;
    cur.credit += Number(line.credit) || 0;
    map.set(line.accountId, cur);
  }
  return [...map.values()].map((row) => ({
    ...row,
    debit: roundMoney(row.debit),
    credit: roundMoney(row.credit),
    balance: naturalBalance(row.accountType, row.debit, row.credit),
  }));
}

function moneyLine(
  id: string,
  label: string,
  amount: number,
  emphasis = false,
): StatementLine {
  return {
    id,
    label,
    amount: roundMoney(amount),
    amountLabel: formatInr(roundMoney(amount)),
    emphasis,
  };
}

export type LedgerProfitLossVm = {
  revenue: number;
  revenueLabel: string;
  cogs: number;
  cogsLabel: string;
  grossProfit: number;
  grossProfitLabel: string;
  grossMarginPercent: number | null;
  grossMarginLabel: string;
  operatingExpenses: number;
  operatingExpensesLabel: string;
  payroll: number;
  payrollLabel: string;
  otherExpenses: number;
  otherExpensesLabel: string;
  netProfit: number;
  netProfitLabel: string;
  lines: StatementLine[];
  hasActivity: boolean;
  disclaimer: string;
};

export function buildLedgerProfitLoss(
  periodLines: readonly LedgerLineFact[],
): LedgerProfitLossVm {
  const accounts = totalsByAccount(periodLines);
  let revenue = 0;
  let cogs = 0;
  let operatingExpenses = 0;
  let payroll = 0;
  let otherExpenses = 0;

  for (const account of accounts) {
    if (account.accountType === 'REVENUE') {
      revenue += account.balance;
      continue;
    }
    if (account.accountType !== 'EXPENSE') continue;
    if (account.accountCode === '5000') cogs += account.balance;
    else if (account.accountCode === '5100') operatingExpenses += account.balance;
    else if (account.accountCode === '5200') payroll += account.balance;
    else otherExpenses += account.balance;
  }

  revenue = roundMoney(revenue);
  cogs = roundMoney(cogs);
  operatingExpenses = roundMoney(operatingExpenses);
  payroll = roundMoney(payroll);
  otherExpenses = roundMoney(otherExpenses);
  const grossProfit = roundMoney(revenue - cogs);
  const netProfit = roundMoney(
    grossProfit - operatingExpenses - payroll - otherExpenses,
  );
  const grossMarginPercent =
    revenue > 0 ? roundMoney((grossProfit / revenue) * 100) : null;

  return {
    revenue,
    revenueLabel: formatInr(revenue),
    cogs,
    cogsLabel: formatInr(cogs),
    grossProfit,
    grossProfitLabel: formatInr(grossProfit),
    grossMarginPercent,
    grossMarginLabel:
      grossMarginPercent == null ? '—' : `${grossMarginPercent}%`,
    operatingExpenses,
    operatingExpensesLabel: formatInr(operatingExpenses),
    payroll,
    payrollLabel: formatInr(payroll),
    otherExpenses,
    otherExpensesLabel: formatInr(otherExpenses),
    netProfit,
    netProfitLabel: formatInr(netProfit),
    lines: [
      moneyLine('revenue', 'Revenue / Sales', revenue),
      moneyLine('cogs', 'Cost of Goods Sold', cogs),
      moneyLine('gross', 'Gross Profit', grossProfit, true),
      moneyLine('opex', 'Company Expenses', operatingExpenses),
      moneyLine('payroll', 'Payroll', payroll),
      moneyLine('other', 'Other Expenses', otherExpenses),
      moneyLine('net', 'Net Profit', netProfit, true),
    ],
    hasActivity: periodLines.length > 0,
    disclaimer:
      'Profit & Loss is built from posted Books journals for this date range. Update Books before relying on these figures.',
  };
}

export type BalanceSheetSectionRow = {
  accountCode: string;
  accountName: string;
  amount: number;
  amountLabel: string;
};

export type BalanceSheetVm = {
  asOfDate: string;
  assets: BalanceSheetSectionRow[];
  assetsTotal: number;
  assetsTotalLabel: string;
  liabilities: BalanceSheetSectionRow[];
  liabilitiesTotal: number;
  liabilitiesTotalLabel: string;
  equity: BalanceSheetSectionRow[];
  retainedEarnings: number;
  retainedEarningsLabel: string;
  equityTotal: number;
  equityTotalLabel: string;
  liabilitiesAndEquityTotal: number;
  liabilitiesAndEquityTotalLabel: string;
  balanced: boolean;
  hasActivity: boolean;
  disclaimer: string;
};

export function buildBalanceSheet(
  linesThroughAsOf: readonly LedgerLineFact[],
  asOfDate: string,
): BalanceSheetVm {
  const accounts = totalsByAccount(linesThroughAsOf);
  const assets: BalanceSheetSectionRow[] = [];
  const liabilities: BalanceSheetSectionRow[] = [];
  const equity: BalanceSheetSectionRow[] = [];
  let assetsTotal = 0;
  let liabilitiesTotal = 0;
  let equityAccountsTotal = 0;
  let revenueToDate = 0;
  let expensesToDate = 0;

  for (const account of accounts) {
    if (account.balance === 0) continue;
    const row = {
      accountCode: account.accountCode,
      accountName: account.accountName,
      amount: account.balance,
      amountLabel: formatInr(account.balance),
    };
    if (account.accountType === 'ASSET') {
      assets.push(row);
      assetsTotal += account.balance;
    } else if (account.accountType === 'LIABILITY') {
      liabilities.push(row);
      liabilitiesTotal += account.balance;
    } else if (account.accountType === 'EQUITY') {
      equity.push(row);
      equityAccountsTotal += account.balance;
    } else if (account.accountType === 'REVENUE') {
      revenueToDate += account.balance;
    } else if (account.accountType === 'EXPENSE') {
      expensesToDate += account.balance;
    }
  }

  const retainedEarnings = roundMoney(revenueToDate - expensesToDate);
  const equityTotal = roundMoney(equityAccountsTotal + retainedEarnings);
  assetsTotal = roundMoney(assetsTotal);
  liabilitiesTotal = roundMoney(liabilitiesTotal);
  const liabilitiesAndEquityTotal = roundMoney(liabilitiesTotal + equityTotal);

  return {
    asOfDate,
    assets: assets.sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
    assetsTotal,
    assetsTotalLabel: formatInr(assetsTotal),
    liabilities: liabilities.sort((a, b) =>
      a.accountCode.localeCompare(b.accountCode),
    ),
    liabilitiesTotal,
    liabilitiesTotalLabel: formatInr(liabilitiesTotal),
    equity: equity.sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
    retainedEarnings,
    retainedEarningsLabel: formatInr(retainedEarnings),
    equityTotal,
    equityTotalLabel: formatInr(equityTotal),
    liabilitiesAndEquityTotal,
    liabilitiesAndEquityTotalLabel: formatInr(liabilitiesAndEquityTotal),
    balanced: assetsTotal === liabilitiesAndEquityTotal,
    hasActivity: linesThroughAsOf.length > 0,
    disclaimer:
      'Balance Sheet is as-of from posted Books journals. Retained earnings = revenue − expenses through this date.',
  };
}

export type CashFlowSection = {
  id: string;
  label: string;
  amount: number;
  amountLabel: string;
};

export type CashFlowVm = {
  openingCashBank: number;
  openingCashBankLabel: string;
  operating: number;
  investing: number;
  financing: number;
  netChange: number;
  closingCashBank: number;
  closingCashBankLabel: string;
  sections: CashFlowSection[];
  hasActivity: boolean;
  disclaimer: string;
};

const OPERATING_SOURCES = new Set([
  'collection',
  'company_expense',
  'payroll',
  'supplier_payment',
  'sale',
  'purchase_receive',
]);
const FINANCING_SOURCES = new Set([
  'opening_balance',
  'cash_deposit',
  'cash_withdrawal',
]);

function cashBankNetForSource(
  lines: readonly LedgerLineFact[],
  sourceType: string,
): number {
  let net = 0;
  for (const line of lines) {
    if (line.sourceType !== sourceType) continue;
    if (
      line.accountCode !== CASH_ACCOUNT_CODE &&
      line.accountCode !== BANK_ACCOUNT_CODE
    ) {
      continue;
    }
    net += (Number(line.debit) || 0) - (Number(line.credit) || 0);
  }
  return roundMoney(net);
}

export function buildCashFlowStatement(input: {
  openingCashBank: number;
  periodLines: readonly LedgerLineFact[];
}): CashFlowVm {
  let operating = 0;
  let investing = 0;
  let financing = 0;

  const sourceTypes = new Set(input.periodLines.map((l) => l.sourceType));
  for (const sourceType of sourceTypes) {
    if (sourceType === 'cash_transfer') continue; // nets to zero across cash+bank
    const net = cashBankNetForSource(input.periodLines, sourceType);
    if (OPERATING_SOURCES.has(sourceType)) operating += net;
    else if (FINANCING_SOURCES.has(sourceType)) financing += net;
    else investing += net;
  }

  operating = roundMoney(operating);
  investing = roundMoney(investing);
  financing = roundMoney(financing);
  const netChange = roundMoney(operating + investing + financing);
  const opening = roundMoney(input.openingCashBank);
  const closing = roundMoney(opening + netChange);

  return {
    openingCashBank: opening,
    openingCashBankLabel: formatInr(opening),
    operating,
    investing,
    financing,
    netChange,
    closingCashBank: closing,
    closingCashBankLabel: formatInr(closing),
    sections: [
      {
        id: 'opening',
        label: 'Opening cash + bank',
        amount: opening,
        amountLabel: formatInr(opening),
      },
      {
        id: 'operating',
        label: 'Operating',
        amount: operating,
        amountLabel: formatInr(operating),
      },
      {
        id: 'investing',
        label: 'Investing',
        amount: investing,
        amountLabel: formatInr(investing),
      },
      {
        id: 'financing',
        label: 'Financing',
        amount: financing,
        amountLabel: formatInr(financing),
      },
      {
        id: 'net',
        label: 'Net change',
        amount: netChange,
        amountLabel: formatInr(netChange),
      },
      {
        id: 'closing',
        label: 'Closing cash + bank',
        amount: closing,
        amountLabel: formatInr(closing),
      },
    ],
    hasActivity: input.periodLines.length > 0,
    disclaimer:
      'Cash Flow classifies cash/bank journal lines by Books source. Internal cash↔bank transfers are excluded from net change.',
  };
}

export type GeneralLedgerRow = {
  id: string;
  entryDate: string;
  entryDateLabel: string;
  accountCode: string;
  accountName: string;
  sourceType: string;
  memo: string;
  debit: number;
  debitLabel: string;
  credit: number;
  creditLabel: string;
};

export function buildGeneralLedgerRows(
  periodLines: readonly LedgerLineFact[],
  formatDateLabel: (isoDate: string) => string,
  accountCode?: string | null,
): GeneralLedgerRow[] {
  return periodLines
    .filter((line) =>
      accountCode ? line.accountCode === accountCode : true,
    )
    .slice()
    .sort((a, b) => {
      const byDate = a.entryDate.localeCompare(b.entryDate);
      if (byDate !== 0) return byDate;
      return a.accountCode.localeCompare(b.accountCode);
    })
    .map((line) => ({
      id: `${line.journalId}:${line.accountId}:${line.debit}:${line.credit}:${line.entryDate}`,
      entryDate: line.entryDate,
      entryDateLabel: formatDateLabel(line.entryDate),
      accountCode: line.accountCode,
      accountName: line.accountName,
      sourceType: line.sourceType,
      memo: line.memo,
      debit: roundMoney(line.debit),
      debitLabel: line.debit > 0 ? formatInr(roundMoney(line.debit)) : '—',
      credit: roundMoney(line.credit),
      creditLabel: line.credit > 0 ? formatInr(roundMoney(line.credit)) : '—',
    }));
}

export type LedgerTrialBalanceRow = {
  accountId: string;
  code: string;
  name: string;
  accountTypeLabel: string;
  debit: number;
  credit: number;
  debitLabel: string;
  creditLabel: string;
};

export type LedgerStatementsSnapshot = {
  generatedAtLabel: string;
  rangeLabel: string;
  asOfDate: string;
  profitLoss: LedgerProfitLossVm;
  balanceSheet: BalanceSheetVm;
  cashFlow: CashFlowVm;
  trialBalance: LedgerTrialBalanceRow[];
  trialBalanceBalanced: boolean;
  trialBalanceDebitTotalLabel: string;
  trialBalanceCreditTotalLabel: string;
  generalLedger: GeneralLedgerRow[];
  journalCount: number;
  hasLedgerActivity: boolean;
  honestyNote: string;
};

/** Cash + bank natural asset balance from ledger facts. */
export function cashBankBalanceFromLines(
  lines: readonly LedgerLineFact[],
): number {
  let net = 0;
  for (const line of lines) {
    if (
      line.accountCode !== CASH_ACCOUNT_CODE &&
      line.accountCode !== BANK_ACCOUNT_CODE
    ) {
      continue;
    }
    net += (Number(line.debit) || 0) - (Number(line.credit) || 0);
  }
  return roundMoney(net);
}

export function buildLedgerTrialBalance(
  linesThroughAsOf: readonly LedgerLineFact[],
): {
  rows: LedgerTrialBalanceRow[];
  balanced: boolean;
  totalDebit: number;
  totalCredit: number;
} {
  const accounts = totalsByAccount(linesThroughAsOf);
  let totalDebit = 0;
  let totalCredit = 0;
  const rows: LedgerTrialBalanceRow[] = [];

  for (const account of accounts) {
    if (account.debit === 0 && account.credit === 0) continue;
    const net = naturalBalance(
      account.accountType,
      account.debit,
      account.credit,
    );
    let debit = 0;
    let credit = 0;
    if (account.accountType === 'ASSET' || account.accountType === 'EXPENSE') {
      if (net >= 0) debit = net;
      else credit = roundMoney(-net);
    } else if (net >= 0) {
      credit = net;
    } else {
      debit = roundMoney(-net);
    }
    totalDebit += debit;
    totalCredit += credit;
    rows.push({
      accountId: account.accountId,
      code: account.accountCode,
      name: account.accountName,
      accountTypeLabel: account.accountType,
      debit,
      credit,
      debitLabel: debit > 0 ? formatInr(debit) : '—',
      creditLabel: credit > 0 ? formatInr(credit) : '—',
    });
  }

  totalDebit = roundMoney(totalDebit);
  totalCredit = roundMoney(totalCredit);
  return {
    rows: rows.sort((a, b) => a.code.localeCompare(b.code)),
    balanced: totalDebit === totalCredit,
    totalDebit,
    totalCredit,
  };
}
