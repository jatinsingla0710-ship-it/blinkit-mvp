import type { KpiTrend, KpiTrendDirection } from '@/data/dashboard-types';

export function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function isSameCalendarDay(a: string | Date, b: string | Date): boolean {
  const da = typeof a === 'string' ? new Date(a) : a;
  const db = typeof b === 'string' ? new Date(b) : b;
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function isInMonth(iso: string, monthStart: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === monthStart.getFullYear() &&
    d.getMonth() === monthStart.getMonth()
  );
}

export function todayDateParam(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildTrend(
  current: number,
  previous: number,
  periodLabel: string,
): KpiTrend | undefined {
  if (previous <= 0 && current <= 0) {
    return { direction: 'flat', label: `No change vs ${periodLabel}` };
  }
  if (previous <= 0) {
    return { direction: 'up', label: `New vs ${periodLabel}` };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) {
    return { direction: 'flat', label: `Flat vs ${periodLabel}` };
  }
  const direction: KpiTrendDirection = pct > 0 ? 'up' : 'down';
  const sign = pct > 0 ? '+' : '';
  return {
    direction,
    label: `${sign}${pct}% vs ${periodLabel}`,
  };
}

export function ordersPresetHref(preset: string): string {
  return `/orders?preset=${encodeURIComponent(preset)}`;
}

/** Pending payments for today's billed/delivered sales. */
export function pendingPaymentsTodayHref(d = new Date()): string {
  return `/orders?payment=UNPAID&date=${encodeURIComponent(todayDateParam(d))}`;
}

/** Local calendar date as YYYY-MM-DD for Postgres `date` columns. */
export function toDateOnly(d = new Date()): string {
  return todayDateParam(d);
}
