import { newClientRequestId } from '@/data/counter-sale';
import type { PurchaseItemRow } from '@/data/purchasing';

export type ReturnLineDraft = {
  purchaseItemId: string;
  quantity: number;
};

export type ReturnPreview =
  | {
      ok: true;
      lines: ReturnLineDraft[];
      reason: string;
      taxableAmount: number;
      taxAmount: number;
      totalAmount: number;
      completesNetReceived: boolean;
    }
  | { ok: false; error: string };

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function roundQty(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Plan a supplier return against net received quantities.
 * Tax estimate mirrors server pro-rata from remaining returnable tax.
 */
export function planPurchaseReturn(input: {
  items: readonly PurchaseItemRow[];
  quantities: Readonly<Record<string, string>>;
  reason: string;
  receiptTaxable: number;
  receiptTax: number;
  priorReturnTaxable: number;
  priorReturnTax: number;
}): ReturnPreview {
  const reason = input.reason.trim();
  if (!reason) {
    return { ok: false, error: 'Return reason is required' };
  }
  if (reason.length > 500) {
    return { ok: false, error: 'Return reason must be at most 500 characters' };
  }

  const lines: ReturnLineDraft[] = [];
  let taxable = 0;

  for (const item of input.items) {
    const raw = (input.quantities[item.id] ?? '').trim();
    if (!raw) continue;
    const qty = Number(raw);
    if (!Number.isFinite(qty) || qty <= 0) {
      return {
        ok: false,
        error: `Enter a positive quantity for ${item.productName}`,
      };
    }
    const rounded = roundQty(qty);
    if (rounded > item.remainingReturnable + 1e-9) {
      return {
        ok: false,
        error: `Cannot return ${rounded} of ${item.productName} — only ${item.remainingReturnable} returnable`,
      };
    }
    taxable = roundMoney(taxable + roundMoney(rounded * item.unitCost));
    lines.push({ purchaseItemId: item.id, quantity: rounded });
  }

  if (lines.length === 0) {
    return { ok: false, error: 'Enter a quantity for at least one line' };
  }

  const remainingTaxable = roundMoney(
    Math.max(0, input.receiptTaxable - input.priorReturnTaxable),
  );
  const remainingTax = roundMoney(
    Math.max(0, input.receiptTax - input.priorReturnTax),
  );

  const completesNetReceived = input.items.every((item) => {
    const adding =
      lines.find((l) => l.purchaseItemId === item.id)?.quantity ?? 0;
    return item.remainingReturnable <= adding + 1e-9;
  });

  let taxAmount = 0;
  if (input.receiptTax > 0 && taxable > 0) {
    if (completesNetReceived) {
      taxAmount = remainingTax;
    } else if (remainingTaxable > 0) {
      taxAmount = roundMoney(remainingTax * (taxable / remainingTaxable));
      if (taxAmount > remainingTax) taxAmount = remainingTax;
    }
  }

  return {
    ok: true,
    lines,
    reason,
    taxableAmount: taxable,
    taxAmount,
    totalAmount: roundMoney(taxable + taxAmount),
    completesNetReceived,
  };
}

export function returnSubmissionFingerprint(input: {
  purchaseId: string;
  reason: string;
  lines: readonly ReturnLineDraft[];
}): string {
  const parts = [...input.lines]
    .map((l) => `${l.purchaseItemId}:${l.quantity}`)
    .sort();
  return `${input.purchaseId}|${input.reason.trim()}|${parts.join(',')}`;
}

export function nextReturnClientRequestId(input: {
  previousId: string;
  previousFingerprint: string | null;
  nextFingerprint: string;
  lastOutcome: 'none' | 'error' | 'success';
}): { id: string; fingerprint: string } {
  if (
    input.lastOutcome === 'error' &&
    input.previousFingerprint === input.nextFingerprint
  ) {
    return { id: input.previousId, fingerprint: input.nextFingerprint };
  }
  return {
    id: newClientRequestId(),
    fingerprint: input.nextFingerprint,
  };
}

export function formatPurchaseReturnError(
  error: unknown,
  fallback = 'Could not create supplier return',
): string {
  const raw =
    error instanceof Error && error.message.trim()
      ? error.message
      : typeof error === 'string'
        ? error
        : fallback;
  const lower = raw.toLowerCase();

  if (
    lower.includes('client_request_id already used') ||
    lower.includes('already used for a different') ||
    lower.includes('already used with different') ||
    lower.includes('already used with a different return reason')
  ) {
    return 'This return request was already used with different details. Refresh and try again.';
  }
  if (lower.includes('exceeds net received') || lower.includes('exceeds net on')) {
    return 'Return quantity exceeds net received. Refresh and adjust quantities.';
  }
  if (lower.includes('below reserved')) {
    return 'Cannot return stock that is reserved for open orders. Free reserved stock first.';
  }
  if (lower.includes('return reason is required')) {
    return 'Return reason is required.';
  }
  if (lower.includes('only admin') || lower.includes('42501')) {
    return 'You need admin permission to create supplier returns.';
  }
  return raw.trim() || fallback;
}
