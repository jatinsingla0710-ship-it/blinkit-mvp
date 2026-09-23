import { describe, expect, it } from 'vitest';
import {
  currentFinancialYear,
  dateRangeForPreset,
  formatGrowthLabel,
  fyBoundsForDate,
  growthPct,
  previousFinancialYear,
  FY_MONTH_LABELS,
} from './sales-fiscal';
import {
  chartSeriesForView,
  mapSalesDashboardMetrics,
} from './sales-dashboard-map';

describe('sales-fiscal', () => {
  it('FY 2026-27 for September 2026', () => {
    const fy = currentFinancialYear(new Date('2026-09-15'));
    expect(fy.label).toBe('FY 2026–27');
    expect(fy.start.getMonth()).toBe(3); // April = 3
    expect(fy.start.getFullYear()).toBe(2026);
  });

  it('FY 2025-26 for March 2026', () => {
    const fy = currentFinancialYear(new Date('2026-03-15'));
    expect(fy.label).toBe('FY 2025–26');
    expect(fy.start.getFullYear()).toBe(2025);
  });

  it('previous FY follows current', () => {
    const prev = previousFinancialYear(new Date('2026-09-01'));
    expect(prev.label).toBe('FY 2025–26');
  });

  it('FY month order is April through March', () => {
    expect(FY_MONTH_LABELS[0]).toBe('Apr');
    expect(FY_MONTH_LABELS[11]).toBe('Mar');
  });

  it('growthPct handles zero and negative', () => {
    expect(growthPct(100, 80)).toBe(25);
    expect(growthPct(80, 100)).toBe(-20);
    expect(growthPct(0, 0)).toBe(0);
    expect(growthPct(50, 0)).toBe(100);
    expect(formatGrowthLabel(-8)).toBe('↓ 8%');
  });

  it('dateRangeForPreset last_month', () => {
    const range = dateRangeForPreset('last_month', undefined, new Date('2026-09-01'));
    expect(range.from?.getMonth()).toBe(7); // August
    expect(range.label).toBe('Last month');
  });

  it('fyBoundsForDate matches label format', () => {
    const b = fyBoundsForDate(new Date('2026-01-10'));
    expect(b.label).toBe('FY 2025–26');
  });
});

describe('sales-dashboard-map', () => {
  const samplePayload = {
    asOfDate: '2026-09-01',
    timezone: 'Asia/Kolkata',
    allTime: { amount: 1250000, count: 450 },
    currentMonth: {
      amount: 185000,
      count: 32,
      start: '2026-09-01',
      end: '2026-09-01',
      compareAmount: 160000,
      growthPct: 15.6,
    },
    previousMonth: {
      amount: 240000,
      count: 40,
      start: '2026-08-01',
      end: '2026-08-31',
      label: 'August 2026',
      compareAmount: 220000,
      growthPct: 9.1,
    },
    currentFinancialYear: {
      label: 'FY 2026–27',
      amount: 875000,
      count: 180,
      avgMonthly: 97222,
    },
    previousFinancialYear: {
      label: 'FY 2025–26',
      amount: 1520000,
      count: 320,
      growthPctVsCurrent: -42.4,
    },
    monthComparison: {
      currentAmount: 185000,
      previousAmount: 240000,
      difference: -55000,
      growthPct: -22.9,
    },
    fyComparison: {
      current: { totalSales: 875000, count: 180, avgSaleValue: 4861.11 },
      previous: { totalSales: 1520000, count: 320, avgSaleValue: 4750 },
      growthPct: -42.4,
    },
    performance: {
      totalSales: 1250000,
      saleCount: 450,
      avgSaleValue: 2777.78,
      highestMonth: { label: 'Aug', year: 2026, month: 8, amount: 240000 },
      lowestMonth: { label: 'May', year: 2026, month: 5, amount: 85000 },
      bestDay: { date: '2026-08-15', amount: 45000 },
    },
    monthlyBreakdown: {
      currentFinancialYear: [
        { monthIndex: 0, year: 2026, month: 4, label: 'Apr', amount: 0, count: 0 },
        { monthIndex: 4, year: 2026, month: 8, label: 'Aug', amount: 240000, count: 40 },
      ],
      previousFinancialYear: [],
      calendarYear: { year: 2026, months: [] },
    },
    topCustomers: [],
    topProducts: [],
    paymentBreakdown: [],
  };

  it('maps RPC payload to view model', () => {
    const vm = mapSalesDashboardMetrics(samplePayload);
    expect(vm.allTime.count).toBe(450);
    expect(vm.currentMonth.growthLabel).toContain('15.6%');
    expect(vm.previousMonth.periodLabel).toBe('August 2026');
    expect(vm.currentFinancialYear.label).toBe('FY 2026–27');
    expect(vm.monthComparison.isPositive).toBe(false);
    expect(vm.hasSales).toBe(true);
  });

  it('handles zero sales gracefully', () => {
    const vm = mapSalesDashboardMetrics({
      ...samplePayload,
      allTime: { amount: 0, count: 0 },
      currentMonth: { ...samplePayload.currentMonth, amount: 0, growthPct: 0 },
      performance: {
        totalSales: 0,
        saleCount: 0,
        avgSaleValue: 0,
        highestMonth: { label: '', amount: 0 },
        lowestMonth: { label: '', amount: 0 },
        bestDay: { date: null, amount: 0 },
      },
    });
    expect(vm.hasSales).toBe(false);
    expect(vm.performance.highestMonthLabel).toBe('—');
  });

  it('builds chart series for FY view', () => {
    const vm = mapSalesDashboardMetrics(samplePayload);
    const series = chartSeriesForView(vm, 'current_financial_year');
    expect(series.some((p) => p.value === 240000)).toBe(true);
  });
});
