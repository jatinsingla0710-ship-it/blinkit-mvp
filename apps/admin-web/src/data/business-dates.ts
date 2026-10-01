/**
 * Admin financial reporting uses Asia/Kolkata business days.
 * Shared bounds so P&L, Day Book, and related report reads agree.
 */

export const BUSINESS_TIMEZONE = 'Asia/Kolkata';
export const BUSINESS_UTC_OFFSET = '+05:30';

/** Calendar YYYY-MM-DD in Asia/Kolkata for an instant. */
export function ymdInBusinessTz(instant: Date | string): string {
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Inclusive start of a business calendar day (IST). */
export function businessDayStartIso(ymd: string): string {
  const day = ymd.slice(0, 10);
  return `${day}T00:00:00${BUSINESS_UTC_OFFSET}`;
}

/**
 * Exclusive end of a business calendar day (IST):
 * next calendar day at 00:00:00+05:30.
 */
export function businessDayEndExclusiveIso(ymd: string): string {
  const startMs = Date.parse(businessDayStartIso(ymd));
  if (Number.isNaN(startMs)) return businessDayStartIso(ymd);
  const next = new Date(startMs + 24 * 60 * 60 * 1000);
  return businessDayStartIso(ymdInBusinessTz(next));
}

/** Inclusive end-of-day timestamp matching Day Book query style. */
export function businessDayEndInclusiveIso(ymd: string): string {
  const day = ymd.slice(0, 10);
  return `${day}T23:59:59.999${BUSINESS_UTC_OFFSET}`;
}

/**
 * Inclusive IST window for a selected date range (from/to YYYY-MM-DD).
 * Same semantics as LiveAdminApi.dayBookSnapshot.
 */
export function businessDateRangeInclusive(
  dateFrom: string,
  dateTo: string,
): { fromIso: string; toIsoInclusive: string; toIsoExclusive: string } {
  const from = dateFrom.slice(0, 10);
  const to = dateTo.slice(0, 10);
  return {
    fromIso: businessDayStartIso(from),
    toIsoInclusive: businessDayEndInclusiveIso(to),
    toIsoExclusive: businessDayEndExclusiveIso(to),
  };
}
