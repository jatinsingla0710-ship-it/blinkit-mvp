/**
 * Display labels for a read-only AR/AP reconciliation result.
 * Does not recompute match rules or invent balances.
 */

import { formatInrPrecise } from '@/data/live/format';
import type {
  ArApReconciliationResult,
  ArApReconciliationStatus,
  ArApSideResult,
} from './ar-ap-reconciliation';

const STATUS_LABEL: Record<ArApReconciliationStatus, string> = {
  match: 'Match',
  mismatch: 'Difference',
  inconclusive: 'Not compared',
};

export type ArApReconciliationSideView = {
  id: 'ar' | 'ap';
  title: string;
  domainLabel: string;
  booksLabel: string;
  deltaLabel: string;
  status: ArApReconciliationStatus;
  statusLabel: string;
  reason: string | null;
};

export type ArApReconciliationView = {
  headline: string;
  sides: readonly [ArApReconciliationSideView, ArApReconciliationSideView];
  notes: readonly string[];
};

function moneyLabel(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return formatInrPrecise(value);
}

function deltaLabel(side: ArApSideResult): string {
  if (side.status === 'inconclusive' || !Number.isFinite(side.delta)) return '—';
  if (side.delta > 0) return `+${formatInrPrecise(side.delta)}`;
  return formatInrPrecise(side.delta);
}

function sideView(
  id: 'ar' | 'ap',
  title: string,
  side: ArApSideResult,
): ArApReconciliationSideView {
  return {
    id,
    title,
    domainLabel: moneyLabel(side.domainTotal),
    booksLabel: moneyLabel(side.booksTotal),
    deltaLabel: deltaLabel(side),
    status: side.status,
    statusLabel: STATUS_LABEL[side.status],
    reason: side.reason,
  };
}

/** Owner-facing summary. A mismatch is never described as a match. */
export function arApReconciliationHeadline(
  result: ArApReconciliationResult,
): string {
  if (result.ar.status === 'mismatch' || result.ap.status === 'mismatch') {
    return 'Books and the customer or supplier totals differ.';
  }
  if (
    result.ar.status === 'inconclusive' ||
    result.ap.status === 'inconclusive'
  ) {
    return 'This check is incomplete. It does not say the books match.';
  }
  const tolerance = Number.isFinite(result.tolerance)
    ? formatInrPrecise(result.tolerance)
    : 'the allowed tolerance';
  return `Money Due and Money to Pay match Books within ${tolerance}.`;
}

export function toArApReconciliationView(
  result: ArApReconciliationResult,
): ArApReconciliationView {
  return {
    headline: arApReconciliationHeadline(result),
    sides: [
      sideView('ar', 'Money Due', result.ar),
      sideView('ap', 'Money to Pay', result.ap),
    ],
    notes: result.notes,
  };
}
