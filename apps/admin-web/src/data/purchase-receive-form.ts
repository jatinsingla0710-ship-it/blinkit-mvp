import { newClientRequestId } from '@/data/counter-sale';
import type { PurchaseItemRow } from '@/data/purchasing';

export type ReceiveLineDraft = {
  purchaseItemId: string;
  quantity: number;
};

export type ReceivePreview =
  | {
      ok: true;
      lines: ReceiveLineDraft[];
      taxableAmount: number;
      taxAmount: number;
      totalAmount: number;
      completesBill: boolean;
    }
  | { ok: false; error: string };

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function roundQty(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Plan a partial/full receipt against remaining ordered quantities.
 * Tax estimate mirrors server pro-rata + remainder-on-complete.
 */
export function planPurchaseReceive(input: {
  items: readonly PurchaseItemRow[];
  /** Map purchaseItemId → qty string from the form. */
  quantities: Readonly<Record<string, string>>;
  billSubtotal: number;
  billTax: number;
  priorReceiptTaxable: number;
  priorReceiptTax: number;
}): ReceivePreview {
  const lines: ReceiveLineDraft[] = [];
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
    if (rounded > item.remainingToReceive + 1e-9) {
      return {
        ok: false,
        error: `Cannot receive ${rounded} of ${item.productName} — only ${item.remainingToReceive} remaining`,
      };
    }
    taxable = roundMoney(taxable + roundMoney(rounded * item.unitCost));
    lines.push({ purchaseItemId: item.id, quantity: rounded });
  }

  if (lines.length === 0) {
    return { ok: false, error: 'Enter a quantity for at least one line' };
  }

  const remainingTaxable = roundMoney(
    Math.max(0, input.billSubtotal - input.priorReceiptTaxable),
  );
  const remainingTax = roundMoney(
    Math.max(0, input.billTax - input.priorReceiptTax),
  );

  const completesBill = input.items.every((item) => {
    const adding =
      lines.find((l) => l.purchaseItemId === item.id)?.quantity ?? 0;
    return item.remainingToReceive <= adding + 1e-9;
  });

  let taxAmount = 0;
  if (input.billTax > 0 && taxable > 0) {
    if (completesBill) {
      taxAmount = remainingTax;
    } else if (remainingTaxable > 0) {
      taxAmount = roundMoney(remainingTax * (taxable / remainingTaxable));
      if (taxAmount > remainingTax) taxAmount = remainingTax;
    }
  }

  return {
    ok: true,
    lines,
    taxableAmount: taxable,
    taxAmount,
    totalAmount: roundMoney(taxable + taxAmount),
    completesBill,
  };
}

export function receiveSubmissionFingerprint(input: {
  purchaseId: string;
  lines: readonly ReceiveLineDraft[];
}): string {
  const parts = [...input.lines]
    .map((l) => `${l.purchaseItemId}:${l.quantity}`)
    .sort();
  return `${input.purchaseId}|${parts.join(',')}`;
}

export function nextReceiveClientRequestId(input: {
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

export function formatPurchaseReceiveError(
  error: unknown,
  fallback = 'Could not receive purchase',
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
    lower.includes('already used with different')
  ) {
    return 'This receive request was already used with different details. Refresh and try again.';
  }
  if (lower.includes('exceeds remaining')) {
    return 'Receive quantity exceeds remaining ordered quantity. Refresh and adjust quantities.';
  }
  if (lower.includes('already fully received')) {
    return 'This purchase is already fully received.';
  }
  if (lower.includes('only admin') || lower.includes('42501')) {
    return 'You need admin permission to receive purchases.';
  }
  return raw.trim() || fallback;
}

export function defaultReceiveQuantities(
  items: readonly PurchaseItemRow[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of items) {
    if (item.remainingToReceive > 0) {
      out[item.id] = String(item.remainingToReceive);
    }
  }
  return out;
}
