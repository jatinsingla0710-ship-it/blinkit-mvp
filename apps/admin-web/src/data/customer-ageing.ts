/**
 * Phase 10 — customer AR ageing from open order residual dates.
 * Buckets use calendar days since the oldest unpaid order (no due-date terms yet).
 */

export type ReceivableAgeingBucket =
  | 'current'
  | 'days_1_30'
  | 'days_31_60'
  | 'days_61_plus'
  | 'none';

export const RECEIVABLE_AGEING_LABELS: Record<ReceivableAgeingBucket, string> = {
  current: 'Current (0 days)',
  days_1_30: '1–30 days',
  days_31_60: '31–60 days',
  days_61_plus: '61+ days',
  none: 'Paid up',
};

export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  const ms = Math.max(0, to - from);
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/** Map open-balance age in days to an ageing bucket. */
export function receivableAgeingBucket(
  oldestOpenDays: number | null,
  outstanding: number,
): ReceivableAgeingBucket {
  if (outstanding <= 0 || oldestOpenDays == null) return 'none';
  if (oldestOpenDays <= 0) return 'current';
  if (oldestOpenDays <= 30) return 'days_1_30';
  if (oldestOpenDays <= 60) return 'days_31_60';
  return 'days_61_plus';
}

export function ageingBucketLabel(bucket: ReceivableAgeingBucket): string {
  return RECEIVABLE_AGEING_LABELS[bucket];
}

export type AgeingTotals = {
  current: number;
  days_1_30: number;
  days_31_60: number;
  days_61_plus: number;
};

export function summarizeAgeingOutstanding(
  rows: readonly {
    outstanding: number;
    ageingBucket: ReceivableAgeingBucket;
  }[],
): AgeingTotals {
  const totals: AgeingTotals = {
    current: 0,
    days_1_30: 0,
    days_31_60: 0,
    days_61_plus: 0,
  };
  for (const row of rows) {
    if (row.outstanding <= 0) continue;
    if (row.ageingBucket === 'current') {
      totals.current += row.outstanding;
    } else if (row.ageingBucket === 'days_1_30') {
      totals.days_1_30 += row.outstanding;
    } else if (row.ageingBucket === 'days_31_60') {
      totals.days_31_60 += row.outstanding;
    } else if (row.ageingBucket === 'days_61_plus') {
      totals.days_61_plus += row.outstanding;
    }
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    current: round(totals.current),
    days_1_30: round(totals.days_1_30),
    days_31_60: round(totals.days_31_60),
    days_61_plus: round(totals.days_61_plus),
  };
}
