/**
 * Indian financial year helpers (April → March default).
 * Server RPC admin_sales_dashboard_metrics uses the same start month.
 */

export const DEFAULT_FY_START_MONTH = 4; // April

export type FinancialYearBounds = {
  start: Date;
  end: Date;
  label: string;
  startYear: number;
};

export type SalesDatePreset =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'current_fy'
  | 'previous_fy'
  | 'all_time'
  | 'custom';

export function fyBoundsForDate(
  ref: Date,
  startMonth = DEFAULT_FY_START_MONTH,
): FinancialYearBounds {
  const y = ref.getFullYear();
  const m = ref.getMonth() + 1;
  const startYear = m >= startMonth ? y : y - 1;
  const endYear = startYear + 1;
  const start = new Date(startYear, startMonth - 1, 1);
  const end = new Date(endYear, startMonth - 1, 1);
  end.setDate(end.getDate() - 1);
  return {
    start,
    end,
    startYear,
    label: `FY ${startYear}–${String(endYear % 100).padStart(2, '0')}`,
  };
}

export function currentFinancialYear(
  asOf = new Date(),
  startMonth = DEFAULT_FY_START_MONTH,
): FinancialYearBounds {
  return fyBoundsForDate(asOf, startMonth);
}

export function previousFinancialYear(
  asOf = new Date(),
  startMonth = DEFAULT_FY_START_MONTH,
): FinancialYearBounds {
  const cur = fyBoundsForDate(asOf, startMonth);
  const prevRef = new Date(cur.start);
  prevRef.setDate(prevRef.getDate() - 1);
  return fyBoundsForDate(prevRef, startMonth);
}

/** FY month labels in order (Apr → Mar). */
export const FY_MONTH_LABELS = [
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
  'Jan',
  'Feb',
  'Mar',
] as const;

export function growthPct(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function formatGrowthLabel(pct: number): string {
  if (pct > 0) return `↑ ${pct}%`;
  if (pct < 0) return `↓ ${Math.abs(pct)}%`;
  return '—';
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function dateRangeForPreset(
  preset: SalesDatePreset,
  custom?: { from?: string; to?: string },
  asOf = new Date(),
): { from: Date | null; to: Date | null; label: string } {
  const today = startOfDay(asOf);
  switch (preset) {
    case 'today':
      return { from: today, to: endOfDay(today), label: 'Today' };
    case 'this_week': {
      const dow = today.getDay();
      const mondayOffset = dow === 0 ? -6 : 1 - dow;
      const from = new Date(today);
      from.setDate(from.getDate() + mondayOffset);
      return { from, to: endOfDay(today), label: 'This week' };
    }
    case 'this_month': {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from, to: endOfDay(today), label: 'This month' };
    }
    case 'last_month': {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from, to: endOfDay(to), label: 'Last month' };
    }
    case 'current_fy': {
      const fy = currentFinancialYear(today);
      return { from: fy.start, to: endOfDay(today), label: fy.label };
    }
    case 'previous_fy': {
      const fy = previousFinancialYear(today);
      return { from: fy.start, to: endOfDay(fy.end), label: fy.label };
    }
    case 'custom': {
      const from = custom?.from ? startOfDay(new Date(custom.from)) : null;
      const to = custom?.to ? endOfDay(new Date(custom.to)) : null;
      return { from, to, label: 'Custom range' };
    }
    case 'all_time':
    default:
      return { from: null, to: null, label: 'All time' };
  }
}
