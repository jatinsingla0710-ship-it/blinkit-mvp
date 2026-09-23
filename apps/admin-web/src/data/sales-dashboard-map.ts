import type { ChartSeriesPoint } from '@/data/reports-types';
import { formatInr, formatDate } from '@/data/live/format';
import { formatGrowthLabel } from '@/data/sales-fiscal';

export type SalesMonthlyPoint = {
  monthIndex: number;
  year: number;
  month: number;
  label: string;
  amount: number;
  count: number;
};

export type SalesDashboardMetricsVm = {
  asOfDate: string;
  timezone: string;
  allTime: { amount: number; amountLabel: string; count: number; hint: string };
  currentMonth: {
    amount: number;
    amountLabel: string;
    count: number;
    periodLabel: string;
    growthPct: number;
    growthLabel: string;
    compareHint: string;
  };
  previousMonth: {
    amount: number;
    amountLabel: string;
    count: number;
    periodLabel: string;
    growthPct: number;
    growthLabel: string;
    hint: string;
  };
  currentFinancialYear: {
    label: string;
    amount: number;
    amountLabel: string;
    count: number;
    avgMonthlyLabel: string;
    hint: string;
  };
  previousFinancialYear: {
    label: string;
    amount: number;
    amountLabel: string;
    count: number;
    growthPct: number;
    growthLabel: string;
    compareHint: string;
  };
  performance: {
    totalSalesLabel: string;
    saleCount: number;
    avgSaleValueLabel: string;
    highestMonthLabel: string;
    lowestMonthLabel: string;
    bestDayLabel: string;
  };
  monthComparison: {
    currentLabel: string;
    previousLabel: string;
    differenceLabel: string;
    growthPct: number;
    growthLabel: string;
    isPositive: boolean;
  };
  fyComparison: {
    current: { totalLabel: string; count: number; avgLabel: string };
    previous: { totalLabel: string; count: number; avgLabel: string };
    growthPct: number;
    growthLabel: string;
  };
  monthlyBreakdown: {
    currentFy: SalesMonthlyPoint[];
    previousFy: SalesMonthlyPoint[];
    calendarYear: { year: number; months: SalesMonthlyPoint[] };
  };
  topCustomers: { name: string; amountLabel: string; count: number }[];
  topProducts: {
    name: string;
    sku: string;
    revenueLabel: string;
    quantity: number;
  }[];
  paymentBreakdown: {
    method: string;
    methodLabel: string;
    amountLabel: string;
    count: number;
  }[];
  hasSales: boolean;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  return v == null ? '' : String(v);
}

function mapMonthly(rows: unknown): SalesMonthlyPoint[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      monthIndex: num(row.monthIndex),
      year: num(row.year),
      month: num(row.month),
      label: str(row.label),
      amount: num(row.amount),
      count: num(row.count),
    };
  });
}

function formatMonthPeriod(start: string, end: string): string {
  const s = formatDate(start);
  const e = formatDate(end);
  return s === e ? s : `${s} – ${e}`;
}

function paymentMethodLabel(method: string): string {
  return method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function mapSalesDashboardMetrics(
  raw: Record<string, unknown>,
): SalesDashboardMetricsVm {
  const allTime = (raw.allTime ?? {}) as Record<string, unknown>;
  const currentMonth = (raw.currentMonth ?? {}) as Record<string, unknown>;
  const previousMonth = (raw.previousMonth ?? {}) as Record<string, unknown>;
  const currentFy = (raw.currentFinancialYear ?? {}) as Record<string, unknown>;
  const previousFy = (raw.previousFinancialYear ?? {}) as Record<string, unknown>;
  const performance = (raw.performance ?? {}) as Record<string, unknown>;
  const monthComparison = (raw.monthComparison ?? {}) as Record<string, unknown>;
  const fyComparison = (raw.fyComparison ?? {}) as Record<string, unknown>;
  const monthly = (raw.monthlyBreakdown ?? {}) as Record<string, unknown>;
  const calYear = (monthly.calendarYear ?? {}) as Record<string, unknown>;
  const highest = (performance.highestMonth ?? {}) as Record<string, unknown>;
  const lowest = (performance.lowestMonth ?? {}) as Record<string, unknown>;
  const bestDay = (performance.bestDay ?? {}) as Record<string, unknown>;
  const fyCur = (fyComparison.current ?? {}) as Record<string, unknown>;
  const fyPrev = (fyComparison.previous ?? {}) as Record<string, unknown>;

  const allAmount = num(allTime.amount);
  const curMonthGrowth = num(currentMonth.growthPct);
  const prevMonthGrowth = num(previousMonth.growthPct);
  const fyGrowth = num(previousFy.growthPctVsCurrent);
  const monthCompGrowth = num(monthComparison.growthPct);

  return {
    asOfDate: str(raw.asOfDate),
    timezone: str(raw.timezone) || 'Asia/Kolkata',
    allTime: {
      amount: allAmount,
      amountLabel: formatInr(allAmount),
      count: num(allTime.count),
      hint: 'All-time completed sales',
    },
    currentMonth: {
      amount: num(currentMonth.amount),
      amountLabel: formatInr(num(currentMonth.amount)),
      count: num(currentMonth.count),
      periodLabel: formatMonthPeriod(
        str(currentMonth.start),
        str(currentMonth.end),
      ),
      growthPct: curMonthGrowth,
      growthLabel: formatGrowthLabel(curMonthGrowth),
      compareHint: `${formatGrowthLabel(curMonthGrowth)} compared with same period last year`,
    },
    previousMonth: {
      amount: num(previousMonth.amount),
      amountLabel: formatInr(num(previousMonth.amount)),
      count: num(previousMonth.count),
      periodLabel: str(previousMonth.label) || 'Last month',
      growthPct: prevMonthGrowth,
      growthLabel: formatGrowthLabel(prevMonthGrowth),
      hint: `${num(previousMonth.count)} completed sales`,
    },
    currentFinancialYear: {
      label: str(currentFy.label),
      amount: num(currentFy.amount),
      amountLabel: formatInr(num(currentFy.amount)),
      count: num(currentFy.count),
      avgMonthlyLabel: formatInr(num(currentFy.avgMonthly)),
      hint: `${num(currentFy.count)} sales · avg ${formatInr(num(currentFy.avgMonthly))}/mo`,
    },
    previousFinancialYear: {
      label: str(previousFy.label),
      amount: num(previousFy.amount),
      amountLabel: formatInr(num(previousFy.amount)),
      count: num(previousFy.count),
      growthPct: fyGrowth,
      growthLabel: formatGrowthLabel(fyGrowth),
      compareHint:
        fyGrowth >= 0
          ? `Current FY is ${Math.abs(fyGrowth)}% higher than last FY`
          : `Current FY is ${Math.abs(fyGrowth)}% lower than last FY`,
    },
    performance: {
      totalSalesLabel: formatInr(num(performance.totalSales)),
      saleCount: num(performance.saleCount),
      avgSaleValueLabel: formatInr(num(performance.avgSaleValue)),
      highestMonthLabel: highest.amount
        ? `${str(highest.label)} — ${formatInr(num(highest.amount))}`
        : '—',
      lowestMonthLabel: lowest.amount
        ? `${str(lowest.label)} — ${formatInr(num(lowest.amount))}`
        : '—',
      bestDayLabel: bestDay.date
        ? `${formatDate(str(bestDay.date))} — ${formatInr(num(bestDay.amount))}`
        : '—',
    },
    monthComparison: {
      currentLabel: formatInr(num(monthComparison.currentAmount)),
      previousLabel: formatInr(num(monthComparison.previousAmount)),
      differenceLabel: formatInr(num(monthComparison.difference)),
      growthPct: monthCompGrowth,
      growthLabel: formatGrowthLabel(monthCompGrowth),
      isPositive: num(monthComparison.difference) >= 0,
    },
    fyComparison: {
      current: {
        totalLabel: formatInr(num(fyCur.totalSales)),
        count: num(fyCur.count),
        avgLabel: formatInr(num(fyCur.avgSaleValue)),
      },
      previous: {
        totalLabel: formatInr(num(fyPrev.totalSales)),
        count: num(fyPrev.count),
        avgLabel: formatInr(num(fyPrev.avgSaleValue)),
      },
      growthPct: num(fyComparison.growthPct),
      growthLabel: formatGrowthLabel(num(fyComparison.growthPct)),
    },
    monthlyBreakdown: {
      currentFy: mapMonthly(monthly.currentFinancialYear),
      previousFy: mapMonthly(monthly.previousFinancialYear),
      calendarYear: {
        year: num(calYear.year),
        months: mapMonthly(calYear.months),
      },
    },
    topCustomers: Array.isArray(raw.topCustomers)
      ? (raw.topCustomers as Record<string, unknown>[]).map((c) => ({
          name: str(c.name) || '—',
          amountLabel: formatInr(num(c.amount)),
          count: num(c.sale_count ?? c.count),
        }))
      : [],
    topProducts: Array.isArray(raw.topProducts)
      ? (raw.topProducts as Record<string, unknown>[]).map((p) => ({
          name: str(p.name) || '—',
          sku: str(p.sku) || '—',
          revenueLabel: formatInr(num(p.revenue)),
          quantity: num(p.quantity),
        }))
      : [],
    paymentBreakdown: Array.isArray(raw.paymentBreakdown)
      ? (raw.paymentBreakdown as Record<string, unknown>[]).map((p) => ({
          method: str(p.method),
          methodLabel: paymentMethodLabel(str(p.method)),
          amountLabel: formatInr(num(p.amount)),
          count: num(p.sale_count ?? p.count),
        }))
      : [],
    hasSales: allAmount > 0 || num(allTime.count) > 0,
  };
}

export type ChartViewMode =
  | 'current_financial_year'
  | 'previous_financial_year'
  | 'calendar_year';

export function monthlyPointsToChartSeries(
  points: SalesMonthlyPoint[],
): ChartSeriesPoint[] {
  return points.map((p) => ({
    label: p.label,
    value: p.amount,
    displayValue: `${formatInr(p.amount)}${p.count > 0 ? ` · ${p.count} sales` : ''}`,
  }));
}

export function chartSeriesForView(
  metrics: SalesDashboardMetricsVm,
  view: ChartViewMode,
): ChartSeriesPoint[] {
  switch (view) {
    case 'previous_financial_year':
      return monthlyPointsToChartSeries(metrics.monthlyBreakdown.previousFy);
    case 'calendar_year':
      return monthlyPointsToChartSeries(
        metrics.monthlyBreakdown.calendarYear.months,
      );
    case 'current_financial_year':
    default:
      return monthlyPointsToChartSeries(metrics.monthlyBreakdown.currentFy);
  }
}
