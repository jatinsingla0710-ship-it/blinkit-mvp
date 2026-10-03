import { describe, expect, it } from 'vitest';
import { buildProfitLoss, type ProfitLossVm } from './financial-reports';
import {
  attributeOperatingChange,
  buildProfitAnomalyAssistantSnapshot,
  getProfitInsightAnswer,
} from './profit-anomaly-assistant';

function pl(partial: {
  sales: number;
  cogs: number;
  expenses: number;
  payroll?: number;
  collections?: number;
  refunds?: number;
  cogsIncomplete?: boolean;
}): ProfitLossVm {
  return buildProfitLoss({
    salesTotal: partial.sales,
    collectionsTotal: partial.collections ?? partial.sales,
    refundsTotal: partial.refunds ?? 0,
    expensesTotal: partial.expenses,
    payrollPaidTotal: partial.payroll ?? 0,
    cogsTotal: partial.cogs,
    cogsIncomplete: partial.cogsIncomplete,
  });
}

describe('Phase 19 profit & anomaly assistant', () => {
  it('explains lower operating result with COGS rising faster than sales', () => {
    const current = pl({ sales: 108000, cogs: 78840, expenses: 10000 });
    const prior = pl({ sales: 100000, cogs: 69000, expenses: 10000 });
    // prior margin 31%, current ~27%
    expect(prior.grossMarginPercent).toBe(31);
    expect(current.grossMarginPercent).toBe(27);

    const snapshot = buildProfitAnomalyAssistantSnapshot({
      generatedAtIso: '2026-10-02T12:00:00.000Z',
      currentRangeLabel: '1–2 Oct 2026',
      priorRangeLabel: '1–30 Sep 2026',
      current,
      prior,
    });

    const why = getProfitInsightAnswer(snapshot, 'why_profit_changed');
    expect(why.summary).toMatch(/lower|higher|unchanged/i);
    expect(why.honestyNote).toMatch(/not AI prediction/i);
    expect(why.findings.some((f) => f.id === 'cogs')).toBe(true);
    expect(why.findings.find((f) => f.id === 'cogs')?.detail).toMatch(
      /faster than sales/i,
    );

    const drivers = attributeOperatingChange(current, prior);
    expect(drivers[0]?.id).toBeTruthy();
  });

  it('flags margin drop and large expenses as unusual — not fraud', () => {
    const current = pl({ sales: 100000, cogs: 80000, expenses: 20000 });
    const prior = pl({ sales: 100000, cogs: 69000, expenses: 8000 });
    const snapshot = buildProfitAnomalyAssistantSnapshot({
      generatedAtIso: '2026-10-02T12:00:00.000Z',
      currentRangeLabel: 'This month',
      priorRangeLabel: 'Last month',
      current,
      prior,
      expenses: [
        {
          id: 'e1',
          amount: 12000,
          amountLabel: '₹12,000.00',
          categoryLabel: 'Rent',
          description: 'Warehouse',
          expenseDateLabel: '1 Oct 2026',
          href: '/expenses/e1',
        },
      ],
      stock: { adjustmentCount: 4, damageCount: 1 },
    });

    const unusual = getProfitInsightAnswer(snapshot, 'what_looks_unusual');
    expect(unusual.summary).toMatch(/not fraud/i);
    expect(unusual.findings.some((f) => f.id === 'margin-drop')).toBe(true);
    expect(unusual.findings.some((f) => f.id === 'expense-spike')).toBe(true);
    expect(unusual.findings.some((f) => f.id === 'expense-e1')).toBe(true);
    expect(unusual.findings.some((f) => f.id === 'stock-adj')).toBe(true);
    expect(unusual.findings.every((f) => !/fraud/i.test(f.title))).toBe(true);
  });

  it('returns empty unusual list when periods are calm', () => {
    const calm = pl({ sales: 100000, cogs: 70000, expenses: 10000 });
    const snapshot = buildProfitAnomalyAssistantSnapshot({
      generatedAtIso: '2026-10-02T12:00:00.000Z',
      currentRangeLabel: 'This month',
      priorRangeLabel: 'Last month',
      current: calm,
      prior: calm,
    });
    const unusual = getProfitInsightAnswer(snapshot, 'what_looks_unusual');
    expect(unusual.findings).toEqual([]);
  });
});
