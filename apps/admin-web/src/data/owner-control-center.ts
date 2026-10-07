/**
 * Phase 23 — Owner Control Center helpers.
 * Dashboard quick actions + unreviewed AI document attention (confirm-only).
 */

import type {
  AttentionAlert,
  DashboardQuickAction,
  QuickActionId,
} from '@/data/dashboard-types';

/** Canonical owner quick actions (Phase 1 hierarchy + Phase 23 AI entry points). */
export const OWNER_CONTROL_QUICK_ACTIONS: readonly DashboardQuickAction[] = [
  {
    id: 'new_sale',
    label: 'New Sale',
    description: 'Create an assisted customer order',
  },
  {
    id: 'new_purchase',
    label: 'New Purchase',
    description: 'Record a supplier bill and receive stock',
    href: '/purchases/new',
  },
  {
    id: 'record_expense',
    label: 'Record Expense',
    description: 'Add business money spent',
    href: '/expenses?create=1',
  },
  {
    id: 'collect_payment',
    label: 'Collect Payment',
    description: 'Open customer balances awaiting collection',
    href: '/payments?tab=all&focus=ofd_unpaid',
  },
  {
    id: 'scan_bill',
    label: 'Scan Bill',
    description: 'Photo a supplier bill — review before it posts',
    href: '/purchases/scan',
  },
  {
    id: 'ask_ai',
    label: 'Ask AI',
    description: 'Ask your books — typed tools only, confirm when speaking',
    href: '/ask',
  },
] as const;

export type PendingAiDocumentCounts = {
  billScans: number;
  receiptScans: number;
  dayBookScans: number;
  paymentProofScans: number;
};

export function totalPendingAiDocuments(
  counts: PendingAiDocumentCounts,
): number {
  return (
    Math.max(0, counts.billScans) +
    Math.max(0, counts.receiptScans) +
    Math.max(0, counts.dayBookScans) +
    Math.max(0, counts.paymentProofScans)
  );
}

/** Prefer the scan surface that still has work; Brief as fallback. */
export function pendingAiDocumentsHref(
  counts: PendingAiDocumentCounts,
): string {
  if (counts.billScans > 0) return '/purchases/scan';
  if (counts.receiptScans > 0) return '/expenses/scan';
  if (counts.dayBookScans > 0) return '/day-book/scan';
  if (counts.paymentProofScans > 0) return '/payments/scan';
  return '/brief';
}

/**
 * One attention card for unreviewed AI/document scans.
 * Never claims documents were posted — owner still confirms.
 */
export function buildUnreviewedAiDocumentsAlert(
  counts: PendingAiDocumentCounts,
): AttentionAlert | null {
  const count = totalPendingAiDocuments(counts);
  if (count <= 0) return null;
  return {
    id: 'unreviewed_ai_documents',
    title: 'Documents waiting for review',
    count,
    severity: 'medium',
    href: pendingAiDocumentsHref(counts),
  };
}

export function ownerControlQuickActionIds(): QuickActionId[] {
  return OWNER_CONTROL_QUICK_ACTIONS.map((a) => a.id);
}
