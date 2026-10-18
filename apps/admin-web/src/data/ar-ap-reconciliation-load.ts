/**
 * Read-only AR/AP reconciliation composition over existing snapshots + pending RPC.
 * Pure mapping: no I/O, sync, or balance mutation. LiveAdminApi loads inputs.
 */

import {
  DEFAULT_AR_AP_RECONCILIATION_TOLERANCE,
  buildArApReconciliation,
  type ArApReconciliationResult,
  type ArApSideResult,
} from './ar-ap-reconciliation';
import type { CashBankJournalCompleteness, CashBankSnapshot } from './cash-bank';
import type { ReceivablesSnapshot } from './customer-ledger';
import type { SupplierPayablesSnapshot } from './supplier-ledger';

const SCOPE_NOTES = [
  'Domain receivables floor each shop outstanding at zero; Books AR is the raw account 1100 net.',
  'Domain payables total excludes supplier credits (negative outstanding); Books AP is the raw account 2000 net.',
  'Pending supplier-payment journals: payments with no journal_entries row (source_type=supplier_payment, source_id=payment.id).',
] as const;

export type PendingSupplierPaymentJournalsParse =
  | { ok: true; pendingTotal: number; pendingCount: number }
  | { ok: false; reason: string };

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function finiteDelta(domainTotal: number, booksTotal: number): number {
  if (!Number.isFinite(domainTotal) || !Number.isFinite(booksTotal)) return 0;
  return roundMoney(domainTotal - booksTotal);
}

function inconclusiveSide(
  domainTotal: number,
  booksTotal: number,
  reason: string,
): ArApSideResult {
  return {
    domainTotal: Number.isFinite(domainTotal) ? roundMoney(domainTotal) : domainTotal,
    booksTotal: Number.isFinite(booksTotal) ? roundMoney(booksTotal) : booksTotal,
    delta: finiteDelta(domainTotal, booksTotal),
    status: 'inconclusive',
    reason,
  };
}

function bothInconclusive(input: {
  asOfDate: string;
  todayBusinessDate: string;
  domainReceivablesTotal: number;
  booksArBalance: number;
  domainPayablesTotal: number;
  booksApBalance: number;
  reason: string;
  notes?: string[];
}): ArApReconciliationResult {
  return {
    asOfDate: input.asOfDate,
    todayBusinessDate: input.todayBusinessDate,
    tolerance: DEFAULT_AR_AP_RECONCILIATION_TOLERANCE,
    ar: inconclusiveSide(
      input.domainReceivablesTotal,
      input.booksArBalance,
      input.reason,
    ),
    ap: inconclusiveSide(
      input.domainPayablesTotal,
      input.booksApBalance,
      input.reason,
    ),
    notes: input.notes ? [...input.notes] : [...SCOPE_NOTES],
  };
}

/**
 * RPC jsonb emits JSON numbers (numeric / integer). Accept only finite JS numbers —
 * never coerce null, '', or booleans via Number().
 */
function parseRpcNonNegativeNumber(value: unknown): number | null {
  if (typeof value !== 'number') return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

function parseRpcNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== 'number') return null;
  if (!Number.isInteger(value) || value < 0) return null;
  return value;
}

/**
 * Parse admin_pending_supplier_payment_journals RPC payload.
 * Errors / malformed shapes never become pendingTotal 0.
 */
export function parsePendingSupplierPaymentJournals(input: {
  data: unknown;
  error: { message?: string } | null;
}): PendingSupplierPaymentJournalsParse {
  if (input.error) {
    return {
      ok: false,
      reason:
        input.error.message?.trim() ||
        'Could not load pending supplier-payment journals.',
    };
  }
  if (input.data == null || typeof input.data !== 'object') {
    return {
      ok: false,
      reason:
        'Pending supplier-payment journals response was missing or malformed.',
    };
  }
  const raw = input.data as Record<string, unknown>;
  const pendingTotal = parseRpcNonNegativeNumber(raw['pendingTotal']);
  if (pendingTotal === null) {
    return {
      ok: false,
      reason:
        'Pending supplier-payment journals returned an invalid pendingTotal.',
    };
  }
  const pendingCount = parseRpcNonNegativeInteger(raw['pendingCount']);
  if (pendingCount === null) {
    return {
      ok: false,
      reason:
        'Pending supplier-payment journals returned an invalid pendingCount.',
    };
  }
  return { ok: true, pendingTotal, pendingCount };
}

export type ComposeArApReconciliationInput = {
  /** Requested / Books cut date (YYYY-MM-DD). Prefer cashBank.asOfDate. */
  asOfDate: string;
  /** Asia/Kolkata business today (YYYY-MM-DD). */
  todayBusinessDate: string;
  domainReceivablesTotal: number;
  domainPayablesTotal: number;
  booksArBalance: number;
  booksApBalance: number;
  journalCompleteness: CashBankJournalCompleteness;
  pending: PendingSupplierPaymentJournalsParse;
};

/**
 * Compose helper inputs from already-loaded snapshots.
 * Enforces Books completeness before any match/mismatch claim.
 */
export function composeArApReconciliation(
  input: ComposeArApReconciliationInput,
): ArApReconciliationResult {
  const asOfDate = input.asOfDate.trim().slice(0, 10);
  const todayBusinessDate = input.todayBusinessDate.trim().slice(0, 10);

  if (input.journalCompleteness.status !== 'complete') {
    const reason =
      input.journalCompleteness.reason?.trim() ||
      (input.journalCompleteness.status === 'truncated'
        ? 'Books journal load is truncated; AR/AP comparison is inconclusive.'
        : 'Books journal completeness is unknown; AR/AP comparison is inconclusive.');
    return bothInconclusive({
      asOfDate,
      todayBusinessDate,
      domainReceivablesTotal: input.domainReceivablesTotal,
      booksArBalance: input.booksArBalance,
      domainPayablesTotal: input.domainPayablesTotal,
      booksApBalance: input.booksApBalance,
      reason,
    });
  }

  // Completeness already verified via exact counts. Do not re-use the helper's
  // booksEntryCount >= entryLimit guard (false-positive when exact === limit).
  const result = buildArApReconciliation({
    asOfDate,
    todayBusinessDate,
    domainReceivablesTotal: input.domainReceivablesTotal,
    booksArBalance: input.booksArBalance,
    domainPayablesTotal: input.domainPayablesTotal,
    booksApBalance: input.booksApBalance,
    pendingSupplierPaymentTotal: input.pending.ok
      ? input.pending.pendingTotal
      : Number.NaN,
    booksEntryCount: 0,
  });

  if (!input.pending.ok) {
    return {
      ...result,
      ap: inconclusiveSide(
        input.domainPayablesTotal,
        input.booksApBalance,
        input.pending.reason,
      ),
    };
  }

  return result;
}

export function composeArApReconciliationFromSnapshots(input: {
  asOfDate: string;
  todayBusinessDate: string;
  receivables: Pick<ReceivablesSnapshot, 'totalOutstanding'>;
  payables: Pick<SupplierPayablesSnapshot, 'totalOutstanding'>;
  cashBank: Pick<
    CashBankSnapshot,
    'asOfDate' | 'moneyExpected' | 'moneyToPay' | 'journalCompleteness'
  >;
  pending: PendingSupplierPaymentJournalsParse;
}): ArApReconciliationResult {
  return composeArApReconciliation({
    asOfDate: input.cashBank.asOfDate || input.asOfDate,
    todayBusinessDate: input.todayBusinessDate,
    domainReceivablesTotal: input.receivables.totalOutstanding,
    domainPayablesTotal: input.payables.totalOutstanding,
    booksArBalance: input.cashBank.moneyExpected,
    booksApBalance: input.cashBank.moneyToPay,
    journalCompleteness: input.cashBank.journalCompleteness,
    pending: input.pending,
  });
}
