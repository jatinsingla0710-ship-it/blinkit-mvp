/**
 * Phase 19 — Profitability & anomaly assistant.
 * Rules-based period comparison over existing P&L + expense/stock signals.
 * Honest: not AI prediction; never says "fraud" without verified evidence.
 */

import { formatDate, formatInr } from '@/data/live/format';
import type { ProfitLossVm } from '@/data/financial-reports';

const HONESTY_NOTE =
  'Compared your books this month vs last month with ranking rules — not AI prediction. Unusual means “stands out vs last month,” not fraud.';

export type ProfitInsightQuestionId =
  | 'why_profit_changed'
  | 'what_looks_unusual';

export type ProfitInsightQuestion = {
  id: ProfitInsightQuestionId;
  label: string;
  shortLabel: string;
};

export const PROFIT_INSIGHT_QUESTIONS: readonly ProfitInsightQuestion[] = [
  {
    id: 'why_profit_changed',
    label: 'Why did profit change this month?',
    shortLabel: 'Profit change',
  },
  {
    id: 'what_looks_unusual',
    label: 'What looks unusual?',
    shortLabel: 'Unusual items',
  },
] as const;

export type ProfitInsightSeverity = 'info' | 'watch' | 'attention';

export type ProfitInsightFinding = {
  id: string;
  severity: ProfitInsightSeverity;
  title: string;
  detail: string;
  href: string | null;
};

export type ProfitInsightAnswer = {
  questionId: ProfitInsightQuestionId;
  title: string;
  summary: string;
  honestyNote: string;
  findings: ProfitInsightFinding[];
  emptyTitle: string;
  emptyDetail: string;
};

export type ExpenseAnomalyInput = {
  id: string;
  amount: number;
  amountLabel: string;
  categoryLabel: string;
  description: string;
  expenseDateLabel: string;
  href: string;
};

export type StockAnomalyInput = {
  adjustmentCount: number;
  damageCount: number;
};

export type ProfitAnomalyAssistantSnapshot = {
  generatedAtLabel: string;
  currentLabel: string;
  priorLabel: string;
  currentRangeLabel: string;
  priorRangeLabel: string;
  current: ProfitLossVm;
  prior: ProfitLossVm;
  honestyNote: string;
  questions: readonly ProfitInsightQuestion[];
  answers: Record<ProfitInsightQuestionId, ProfitInsightAnswer>;
};

function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function moneyLabel(n: number): string {
  return formatInr(roundMoney(n));
}

function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return current === 0 ? 0 : null;
  return roundMoney(((current - prior) / Math.abs(prior)) * 100);
}

function pctLabel(pct: number | null): string {
  if (pct == null) return 'n/a (no prior base)';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct}%`;
}

function deltaLabel(current: number, prior: number): string {
  const d = roundMoney(current - prior);
  const sign = d > 0 ? '+' : '';
  return `${sign}${moneyLabel(d)}`;
}

/** Attribute operating-result change to line items (sales lifts result; costs reduce it). */
export function attributeOperatingChange(
  current: ProfitLossVm,
  prior: ProfitLossVm,
): { id: string; label: string; impact: number; impactLabel: string }[] {
  const parts = [
    {
      id: 'sales',
      label: 'Sales',
      impact: roundMoney(current.salesTotal - prior.salesTotal),
    },
    {
      id: 'cogs',
      label: 'COGS',
      impact: roundMoney(-(current.cogsTotal - prior.cogsTotal)),
    },
    {
      id: 'expenses',
      label: 'Expenses',
      impact: roundMoney(-(current.expensesTotal - prior.expensesTotal)),
    },
    {
      id: 'payroll',
      label: 'Paid payroll',
      impact: roundMoney(-(current.payrollPaidTotal - prior.payrollPaidTotal)),
    },
  ];
  return parts
    .filter((p) => Math.abs(p.impact) >= 0.01)
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .map((p) => ({
      ...p,
      impactLabel: `${p.impact > 0 ? '+' : ''}${moneyLabel(p.impact)}`,
    }));
}

export function buildWhyProfitChangedAnswer(input: {
  current: ProfitLossVm;
  prior: ProfitLossVm;
  currentLabel: string;
  priorLabel: string;
}): ProfitInsightAnswer {
  const { current, prior } = input;
  const opDelta = roundMoney(current.operatingResult - prior.operatingResult);
  const salesPct = pctChange(current.salesTotal, prior.salesTotal);
  const cogsPct = pctChange(current.cogsTotal, prior.cogsTotal);
  const marginNow = current.grossMarginPercent;
  const marginPrior = prior.grossMarginPercent;
  const attribution = attributeOperatingChange(current, prior);

  const findings: ProfitInsightFinding[] = [
    {
      id: 'operating',
      severity: opDelta < 0 ? 'attention' : opDelta > 0 ? 'info' : 'info',
      title:
        opDelta < 0
          ? 'Operating result is lower'
          : opDelta > 0
            ? 'Operating result is higher'
            : 'Operating result is flat',
      detail: `${input.currentLabel}: ${current.operatingResultLabel} · ${input.priorLabel}: ${prior.operatingResultLabel} (${deltaLabel(current.operatingResult, prior.operatingResult)})`,
      href: '/reports/profit-loss',
    },
    {
      id: 'sales',
      severity: 'info',
      title: `Sales ${pctLabel(salesPct)}`,
      detail: `${current.salesTotalLabel} vs ${prior.salesTotalLabel} (${deltaLabel(current.salesTotal, prior.salesTotal)})`,
      href: '/reports/sales',
    },
    {
      id: 'cogs',
      severity:
        salesPct != null &&
        cogsPct != null &&
        cogsPct > salesPct + 2 &&
        current.cogsTotal > prior.cogsTotal
          ? 'watch'
          : 'info',
      title: `COGS ${pctLabel(cogsPct)}`,
      detail: `${current.cogsTotalLabel} vs ${prior.cogsTotalLabel} (${deltaLabel(current.cogsTotal, prior.cogsTotal)})${
        salesPct != null &&
        cogsPct != null &&
        cogsPct > salesPct + 2 &&
        current.cogsTotal > prior.cogsTotal
          ? ' — COGS rose faster than sales (margin pressure from mix or cost).'
          : ''
      }`,
      href: '/reports/profit-loss',
    },
    {
      id: 'margin',
      severity:
        marginNow != null &&
        marginPrior != null &&
        marginNow - marginPrior <= -3
          ? 'attention'
          : 'info',
      title: `Gross margin ${
        marginNow == null || marginPrior == null
          ? '—'
          : `${marginPrior}% → ${marginNow}%`
      }`,
      detail: `Gross profit ${current.grossProfitLabel} vs ${prior.grossProfitLabel}`,
      href: '/reports/profit-loss',
    },
    {
      id: 'expenses',
      severity: 'info',
      title: `Expenses ${pctLabel(pctChange(current.expensesTotal, prior.expensesTotal))}`,
      detail: `${current.expensesTotalLabel} vs ${prior.expensesTotalLabel}`,
      href: '/expenses',
    },
    {
      id: 'payroll',
      severity: 'info',
      title: `Paid payroll ${pctLabel(pctChange(current.payrollPaidTotal, prior.payrollPaidTotal))}`,
      detail: `${current.payrollPaidTotalLabel} vs ${prior.payrollPaidTotalLabel}`,
      href: '/salesmen/payroll',
    },
  ];

  if (attribution.length > 0) {
    const top = attribution.slice(0, 3);
    findings.push({
      id: 'drivers',
      severity: 'info',
      title: 'Main drivers of the change',
      detail: top
        .map((p) => `${p.label} ${p.impactLabel} to operating result`)
        .join(' · '),
      href: '/reports/profit-loss',
    });
  }

  if (current.cogsIncomplete || prior.cogsIncomplete) {
    findings.push({
      id: 'cogs-incomplete',
      severity: 'watch',
      title: 'COGS may be understated',
      detail:
        'Some stock movements lacked unit cost in this comparison window. Treat margin carefully until purchase costs cover that stock.',
      href: '/reports/stock',
    });
  }

  const direction =
    opDelta < 0 ? 'lower' : opDelta > 0 ? 'higher' : 'unchanged';
  return {
    questionId: 'why_profit_changed',
    title: 'Why did profit change this month?',
    summary: `Operating result is ${direction} vs ${input.priorLabel} (${deltaLabel(current.operatingResult, prior.operatingResult)}). Numbers come from your Profit & Loss report.`,
    honestyNote: HONESTY_NOTE,
    findings,
    emptyTitle: 'No profit comparison yet',
    emptyDetail: 'Need sales or costs in this month or last month.',
  };
}

export function buildUnusualFindings(input: {
  current: ProfitLossVm;
  prior: ProfitLossVm;
  expenses: readonly ExpenseAnomalyInput[];
  stock: StockAnomalyInput;
  currentLabel: string;
  priorLabel: string;
}): ProfitInsightFinding[] {
  const { current, prior } = input;
  const findings: ProfitInsightFinding[] = [];

  const marginNow = current.grossMarginPercent;
  const marginPrior = prior.grossMarginPercent;
  if (
    marginNow != null &&
    marginPrior != null &&
    marginNow - marginPrior <= -3
  ) {
    findings.push({
      id: 'margin-drop',
      severity: 'attention',
      title: 'Gross margin looks unusual',
      detail: `Dropped from ${marginPrior}% to ${marginNow}% vs ${input.priorLabel}. Review product mix and purchase costs.`,
      href: '/reports/profit-loss',
    });
  }

  const expensePct = pctChange(current.expensesTotal, prior.expensesTotal);
  const expenseDelta = roundMoney(current.expensesTotal - prior.expensesTotal);
  if (
    expensePct != null &&
    expensePct >= 40 &&
    expenseDelta >= 1000
  ) {
    findings.push({
      id: 'expense-spike',
      severity: 'watch',
      title: 'Expenses look unusual',
      detail: `Up ${expensePct}% (${deltaLabel(current.expensesTotal, prior.expensesTotal)}) vs ${input.priorLabel}.`,
      href: '/expenses',
    });
  }

  const periodExpenses = current.expensesTotal;
  const largeFloor = Math.max(5000, roundMoney(periodExpenses * 0.25));
  for (const expense of input.expenses) {
    if (expense.amount < largeFloor) continue;
    findings.push({
      id: `expense-${expense.id}`,
      severity: 'watch',
      title: 'This expense looks unusual',
      detail: `${expense.amountLabel} · ${expense.categoryLabel}${
        expense.description ? ` · ${expense.description}` : ''
      } on ${expense.expenseDateLabel} (large vs this month’s expense total).`,
      href: expense.href,
    });
  }

  const refundPct = pctChange(current.refundsTotal, prior.refundsTotal);
  const refundDelta = roundMoney(current.refundsTotal - prior.refundsTotal);
  if (
    refundPct != null &&
    refundPct >= 50 &&
    refundDelta >= 1000 &&
    current.refundsTotal > 0
  ) {
    findings.push({
      id: 'refunds',
      severity: 'watch',
      title: 'Refunds look unusual',
      detail: `Up ${refundPct}% (${deltaLabel(current.refundsTotal, prior.refundsTotal)}) vs ${input.priorLabel}.`,
      href: '/reports/collections',
    });
  }

  const adjTotal = input.stock.adjustmentCount + input.stock.damageCount;
  if (adjTotal >= 3) {
    findings.push({
      id: 'stock-adj',
      severity: 'watch',
      title: 'Stock adjustments look unusual',
      detail: `${input.stock.adjustmentCount} manual adjustment${
        input.stock.adjustmentCount === 1 ? '' : 's'
      } and ${input.stock.damageCount} damage movement${
        input.stock.damageCount === 1 ? '' : 's'
      } in ${input.currentLabel}.`,
      href: '/inventory',
    });
  }

  if (current.cogsIncomplete) {
    findings.push({
      id: 'cogs-data',
      severity: 'info',
      title: 'COGS data gap',
      detail:
        'Some dispatch/return movements had no unit cost this month — margin may look better than reality.',
      href: '/reports/stock',
    });
  }

  return findings;
}

export function buildWhatLooksUnusualAnswer(input: {
  current: ProfitLossVm;
  prior: ProfitLossVm;
  expenses: readonly ExpenseAnomalyInput[];
  stock: StockAnomalyInput;
  currentLabel: string;
  priorLabel: string;
}): ProfitInsightAnswer {
  const findings = buildUnusualFindings(input);
  return {
    questionId: 'what_looks_unusual',
    title: 'What looks unusual?',
    summary:
      findings.length === 0
        ? `Nothing stands out vs ${input.priorLabel} under the current rules.`
        : `${findings.length} item${findings.length === 1 ? '' : 's'} stand out vs ${input.priorLabel}. These are flags to review — not fraud labels.`,
    honestyNote: HONESTY_NOTE,
    findings,
    emptyTitle: 'Nothing unusual flagged',
    emptyDetail: `No margin drops, expense spikes, large expenses, refund spikes, or stock-adjustment clusters vs ${input.priorLabel}.`,
  };
}

/** Build Phase 19 assistant from two P&L snapshots + optional anomaly inputs. */
export function buildProfitAnomalyAssistantSnapshot(input: {
  generatedAtIso: string;
  currentLabel?: string;
  priorLabel?: string;
  currentRangeLabel: string;
  priorRangeLabel: string;
  current: ProfitLossVm;
  prior: ProfitLossVm;
  expenses?: readonly ExpenseAnomalyInput[];
  stock?: StockAnomalyInput;
}): ProfitAnomalyAssistantSnapshot {
  const currentLabel = input.currentLabel ?? 'This month';
  const priorLabel = input.priorLabel ?? 'Last month';
  const expenses = input.expenses ?? [];
  const stock = input.stock ?? { adjustmentCount: 0, damageCount: 0 };

  return {
    generatedAtLabel: formatDate(input.generatedAtIso),
    currentLabel,
    priorLabel,
    currentRangeLabel: input.currentRangeLabel,
    priorRangeLabel: input.priorRangeLabel,
    current: input.current,
    prior: input.prior,
    honestyNote: HONESTY_NOTE,
    questions: PROFIT_INSIGHT_QUESTIONS,
    answers: {
      why_profit_changed: buildWhyProfitChangedAnswer({
        current: input.current,
        prior: input.prior,
        currentLabel,
        priorLabel,
      }),
      what_looks_unusual: buildWhatLooksUnusualAnswer({
        current: input.current,
        prior: input.prior,
        expenses,
        stock,
        currentLabel,
        priorLabel,
      }),
    },
  };
}

export function getProfitInsightAnswer(
  snapshot: ProfitAnomalyAssistantSnapshot,
  questionId: ProfitInsightQuestionId,
): ProfitInsightAnswer {
  return snapshot.answers[questionId];
}
