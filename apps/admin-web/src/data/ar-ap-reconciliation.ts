/**
 * Pure AR/AP reconciliation: domain Money Due / Money to Pay vs Books journals.
 *
 * Does not load data, post journals, or mutate balances. Callers supply totals
 * from existing snapshots (receivables / payables / cashBankSnapshot).
 *
 * Scope contract (callers must honor):
 * - Domain receivables = Σ max(0, shop outstanding); each shop floors at zero.
 * - Domain payables total = Σ max(0, supplier outstanding); supplier credits excluded.
 * - Books AR/AP = cashBankSnapshot moneyExpected / moneyToPay (accounts 1100 / 2000).
 * - Pending supplier payments = domain payments with no journal_entries row where
 *   source_type = 'supplier_payment' and source_id = payment.id (not implemented here).
 * - booksEntryCount / entryLimit mirror LiveAdminApi.cashBankSnapshot journal_entries
 *   .limit(CASH_BANK_JOURNAL_ENTRY_LIMIT).
 */

/** Matches LiveAdminApi.cashBankSnapshot journal_entries query limit. */
export const CASH_BANK_JOURNAL_ENTRY_LIMIT = 5000;

export const DEFAULT_AR_AP_RECONCILIATION_TOLERANCE = 0.01;

export type ArApReconciliationStatus = 'match' | 'mismatch' | 'inconclusive';

export type ArApSideResult = {
  domainTotal: number;
  booksTotal: number;
  /** domain − Books (positive ⇒ domain higher than Books). Always finite. */
  delta: number;
  status: ArApReconciliationStatus;
  /** Present when status is inconclusive; optional context otherwise. */
  reason: string | null;
};

export type ArApReconciliationResult = {
  asOfDate: string;
  todayBusinessDate: string;
  tolerance: number;
  ar: ArApSideResult;
  ap: ArApSideResult;
  /**
   * Aggregate notes about intentional scope differences and detection contracts.
   * Never claim the aggregates are accounting-identical in every case.
   */
  notes: string[];
};

export type BuildArApReconciliationInput = {
  asOfDate: string;
  /** Asia/Kolkata business calendar YYYY-MM-DD (same convention as business-dates). */
  todayBusinessDate: string;
  domainReceivablesTotal: number;
  booksArBalance: number;
  domainPayablesTotal: number;
  booksApBalance: number;
  /** Σ supplier payment amounts still missing a supplier_payment journal. */
  pendingSupplierPaymentTotal: number;
  booksEntryCount: number;
  /** Defaults to CASH_BANK_JOURNAL_ENTRY_LIMIT (5000). */
  entryLimit?: number;
  /** Absolute money tolerance; defaults to ₹0.01. */
  tolerance?: number;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalizeYmd(value: string): string {
  return (value ?? '').trim().slice(0, 10);
}

/** Strict calendar YYYY-MM-DD (rejects 2026-02-31, empty, and non-date strings). */
export function isValidBusinessYmd(value: string): boolean {
  const ymd = normalizeYmd(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const year = Number(ymd.slice(0, 4));
  const month = Number(ymd.slice(5, 7));
  const day = Number(ymd.slice(8, 10));
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

function finiteDelta(domainTotal: number, booksTotal: number): number {
  if (!isFiniteNumber(domainTotal) || !isFiniteNumber(booksTotal)) return 0;
  return roundMoney(domainTotal - booksTotal);
}

function displayTotal(value: number): number {
  return isFiniteNumber(value) ? roundMoney(value) : value;
}

function compareSide(input: {
  domainTotal: number;
  booksTotal: number;
  tolerance: number;
}): ArApSideResult {
  const domainTotal = roundMoney(input.domainTotal);
  const booksTotal = roundMoney(input.booksTotal);
  const delta = roundMoney(domainTotal - booksTotal);
  if (Math.abs(delta) <= input.tolerance) {
    return {
      domainTotal,
      booksTotal,
      delta,
      status: 'match',
      reason: null,
    };
  }
  return {
    domainTotal,
    booksTotal,
    delta,
    status: 'mismatch',
    reason: null,
  };
}

function inconclusiveSide(input: {
  domainTotal: number;
  booksTotal: number;
  reason: string;
}): ArApSideResult {
  return {
    domainTotal: displayTotal(input.domainTotal),
    booksTotal: displayTotal(input.booksTotal),
    delta: finiteDelta(input.domainTotal, input.booksTotal),
    status: 'inconclusive',
    reason: input.reason,
  };
}

function bothInconclusive(input: {
  asOfDate: string;
  todayBusinessDate: string;
  tolerance: number;
  domainReceivablesTotal: number;
  booksArBalance: number;
  domainPayablesTotal: number;
  booksApBalance: number;
  reason: string;
  notes: string[];
}): ArApReconciliationResult {
  return {
    asOfDate: input.asOfDate,
    todayBusinessDate: input.todayBusinessDate,
    tolerance: input.tolerance,
    ar: inconclusiveSide({
      domainTotal: input.domainReceivablesTotal,
      booksTotal: input.booksArBalance,
      reason: input.reason,
    }),
    ap: inconclusiveSide({
      domainTotal: input.domainPayablesTotal,
      booksTotal: input.booksApBalance,
      reason: input.reason,
    }),
    notes: input.notes,
  };
}

/**
 * Compare domain receivables/payables totals to Books AR/AP balances.
 * Pure: no I/O. Does not invent balancing entries.
 *
 * Precedence: invalid inputs → invalid dates → historical as-of → entry-limit →
 * per-side money validation → AR compare / AP pending-or-compare.
 */
export function buildArApReconciliation(
  input: BuildArApReconciliationInput,
): ArApReconciliationResult {
  const asOfDate = normalizeYmd(input.asOfDate);
  const todayBusinessDate = normalizeYmd(input.todayBusinessDate);

  const notes: string[] = [
    'Domain receivables floor each shop outstanding at zero; Books AR is the raw account 1100 net.',
    'Domain payables total excludes supplier credits (negative outstanding); Books AP is the raw account 2000 net.',
    'Pending supplier-payment journals: payments with no journal_entries row (source_type=supplier_payment, source_id=payment.id).',
  ];

  const toleranceProvided = input.tolerance !== undefined;
  const toleranceRaw = toleranceProvided
    ? input.tolerance
    : DEFAULT_AR_AP_RECONCILIATION_TOLERANCE;
  const toleranceFinite =
    isFiniteNumber(toleranceRaw) && toleranceRaw >= 0
      ? roundMoney(toleranceRaw)
      : null;

  const entryLimitRaw =
    input.entryLimit === undefined
      ? CASH_BANK_JOURNAL_ENTRY_LIMIT
      : input.entryLimit;
  const entryLimitValid = isPositiveInteger(entryLimitRaw);
  const booksEntryCountValid = isNonNegativeInteger(input.booksEntryCount);

  // Reported tolerance: keep caller's invalid value visible; do not substitute a default.
  const toleranceForResult = isFiniteNumber(toleranceRaw)
    ? roundMoney(toleranceRaw)
    : Number(toleranceRaw);

  if (toleranceFinite === null) {
    return bothInconclusive({
      asOfDate,
      todayBusinessDate,
      tolerance: toleranceForResult,
      domainReceivablesTotal: input.domainReceivablesTotal,
      booksArBalance: input.booksArBalance,
      domainPayablesTotal: input.domainPayablesTotal,
      booksApBalance: input.booksApBalance,
      reason:
        'Tolerance must be a finite number greater than or equal to zero.',
      notes,
    });
  }

  if (!booksEntryCountValid) {
    return bothInconclusive({
      asOfDate,
      todayBusinessDate,
      tolerance: toleranceFinite,
      domainReceivablesTotal: input.domainReceivablesTotal,
      booksArBalance: input.booksArBalance,
      domainPayablesTotal: input.domainPayablesTotal,
      booksApBalance: input.booksApBalance,
      reason:
        'booksEntryCount must be a finite non-negative integer.',
      notes,
    });
  }

  if (!entryLimitValid) {
    return bothInconclusive({
      asOfDate,
      todayBusinessDate,
      tolerance: toleranceFinite,
      domainReceivablesTotal: input.domainReceivablesTotal,
      booksArBalance: input.booksArBalance,
      domainPayablesTotal: input.domainPayablesTotal,
      booksApBalance: input.booksApBalance,
      reason: 'entryLimit must be a finite positive integer.',
      notes,
    });
  }

  const entryLimit = entryLimitRaw;
  const booksEntryCount = input.booksEntryCount;

  if (!isValidBusinessYmd(asOfDate) || !isValidBusinessYmd(todayBusinessDate)) {
    return bothInconclusive({
      asOfDate,
      todayBusinessDate,
      tolerance: toleranceFinite,
      domainReceivablesTotal: input.domainReceivablesTotal,
      booksArBalance: input.booksArBalance,
      domainPayablesTotal: input.domainPayablesTotal,
      booksApBalance: input.booksApBalance,
      reason:
        'asOfDate and todayBusinessDate must be valid YYYY-MM-DD calendar dates.',
      notes,
    });
  }

  if (asOfDate !== todayBusinessDate) {
    return bothInconclusive({
      asOfDate,
      todayBusinessDate,
      tolerance: toleranceFinite,
      domainReceivablesTotal: input.domainReceivablesTotal,
      booksArBalance: input.booksArBalance,
      domainPayablesTotal: input.domainPayablesTotal,
      booksApBalance: input.booksApBalance,
      reason: `As-of ${asOfDate} is not today (${todayBusinessDate}); domain totals are current-only and cannot be compared to a historical Books cut.`,
      notes,
    });
  }

  if (booksEntryCount >= entryLimit) {
    return bothInconclusive({
      asOfDate,
      todayBusinessDate,
      tolerance: toleranceFinite,
      domainReceivablesTotal: input.domainReceivablesTotal,
      booksArBalance: input.booksArBalance,
      domainPayablesTotal: input.domainPayablesTotal,
      booksApBalance: input.booksApBalance,
      reason: `Books journal entry load reached the query limit (${entryLimit}); AR/AP balances may be truncated.`,
      notes,
    });
  }

  const arMoneyOk =
    isFiniteNumber(input.domainReceivablesTotal) &&
    isFiniteNumber(input.booksArBalance);
  const apMoneyOk =
    isFiniteNumber(input.domainPayablesTotal) &&
    isFiniteNumber(input.booksApBalance) &&
    isFiniteNumber(input.pendingSupplierPaymentTotal);

  const ar = arMoneyOk
    ? compareSide({
        domainTotal: input.domainReceivablesTotal,
        booksTotal: input.booksArBalance,
        tolerance: toleranceFinite,
      })
    : inconclusiveSide({
        domainTotal: input.domainReceivablesTotal,
        booksTotal: input.booksArBalance,
        reason:
          'AR money inputs must be finite numbers (domainReceivablesTotal, booksArBalance).',
      });

  let ap: ArApSideResult;
  if (!apMoneyOk) {
    ap = inconclusiveSide({
      domainTotal: input.domainPayablesTotal,
      booksTotal: input.booksApBalance,
      reason:
        'AP money inputs must be finite numbers (domainPayablesTotal, booksApBalance, pendingSupplierPaymentTotal).',
    });
  } else if (input.pendingSupplierPaymentTotal < 0) {
    ap = inconclusiveSide({
      domainTotal: input.domainPayablesTotal,
      booksTotal: input.booksApBalance,
      reason:
        'pendingSupplierPaymentTotal must be a finite number greater than or equal to zero.',
    });
  } else if (input.pendingSupplierPaymentTotal > 0) {
    ap = inconclusiveSide({
      domainTotal: input.domainPayablesTotal,
      booksTotal: input.booksApBalance,
      reason:
        'Supplier payments are pending Books journal sync; AP comparison is inconclusive until those journals exist.',
    });
    notes.push(
      'AP comparison left inconclusive while supplier payments await Books journal sync.',
    );
  } else {
    ap = compareSide({
      domainTotal: input.domainPayablesTotal,
      booksTotal: input.booksApBalance,
      tolerance: toleranceFinite,
    });
  }

  return {
    asOfDate,
    todayBusinessDate,
    tolerance: toleranceFinite,
    ar,
    ap,
    notes,
  };
}
