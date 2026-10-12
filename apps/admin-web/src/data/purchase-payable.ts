/**
 * Phase 6B.2D — purchase payable basis shared by ledger + bill accounting.
 *
 * New path (has receipt-event rows):
 *   basis = sum(receipt totals) − sum(return totals)
 * Legacy (RECEIVED, no receipt rows):
 *   basis = purchases.total (original bill)
 * DRAFT / CANCELLED: 0
 *
 * purchases.total stays the original bill total and is never shrunk.
 * remaining = basis − linked payments (negative = supplier credit / advance).
 */

export type PurchasePayablePath = 'none' | 'legacy' | 'receipt_events';

export type PurchasePayableAmounts = {
  path: PurchasePayablePath;
  /** Economic AP increase for this bill (receipt/legacy), never shrunk bill total. */
  payableBasis: number;
  linkedPayments: number;
  /** basis − payments; negative means supplier credit on this bill. */
  remaining: number;
  creditOnBill: number;
  billTotal: number;
  receiptTotal: number;
  returnTotal: number;
  hasReceiptEvents: boolean;
};

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * True when the purchase status can carry a payable (subject to basis > 0).
 */
export function isPayablePurchaseStatus(status: string): boolean {
  const key = status.toUpperCase();
  return key === 'RECEIVED' || key === 'PARTIALLY_RECEIVED';
}

export function computePurchasePayableAmounts(input: {
  status: string;
  billTotal: number;
  /** Sum of purchase_receipts.total_amount for this purchase. */
  receiptTotal?: number | null;
  /** Sum of purchase_returns.total_amount for this purchase. */
  returnTotal?: number | null;
  /**
   * When true, use receipt/return path even if receiptTotal is 0.
   * When omitted, inferred from receiptTotal/returnTotal presence
   * only if `hasReceiptEvents` is explicitly provided by the caller.
   */
  hasReceiptEvents?: boolean;
  linkedPayments?: number | null;
}): PurchasePayableAmounts {
  const status = input.status.toUpperCase();
  const billTotal = roundMoney(input.billTotal);
  const receiptTotal = roundMoney(input.receiptTotal ?? 0);
  const returnTotal = roundMoney(input.returnTotal ?? 0);
  const linkedPayments = roundMoney(input.linkedPayments ?? 0);
  const hasReceiptEvents = Boolean(input.hasReceiptEvents);

  if (status === 'DRAFT' || status === 'CANCELLED') {
    return {
      path: 'none',
      payableBasis: 0,
      linkedPayments,
      remaining: roundMoney(0 - linkedPayments),
      creditOnBill: roundMoney(Math.max(0, linkedPayments)),
      billTotal,
      receiptTotal,
      returnTotal,
      hasReceiptEvents,
    };
  }

  let path: PurchasePayablePath = 'none';
  let payableBasis = 0;

  if (hasReceiptEvents) {
    path = 'receipt_events';
    payableBasis = roundMoney(Math.max(0, receiptTotal - returnTotal));
  } else if (status === 'RECEIVED') {
    path = 'legacy';
    payableBasis = billTotal;
  } else {
    // PARTIALLY_RECEIVED without receipt rows should not occur; treat as zero.
    path = 'none';
    payableBasis = 0;
  }

  const remaining = roundMoney(payableBasis - linkedPayments);
  return {
    path,
    payableBasis,
    linkedPayments,
    remaining,
    creditOnBill: roundMoney(Math.max(0, -remaining)),
    billTotal,
    receiptTotal,
    returnTotal,
    hasReceiptEvents,
  };
}

/** Aggregate receipt/return totals by purchase id. */
export function aggregatePayableEventTotals(
  receipts: readonly { purchaseId: string; totalAmount: number }[],
  returns: readonly { purchaseId: string; totalAmount: number }[],
): Map<
  string,
  { receiptTotal: number; returnTotal: number; hasReceiptEvents: boolean }
> {
  const map = new Map<
    string,
    { receiptTotal: number; returnTotal: number; hasReceiptEvents: boolean }
  >();

  for (const row of receipts) {
    const cur = map.get(row.purchaseId) ?? {
      receiptTotal: 0,
      returnTotal: 0,
      hasReceiptEvents: false,
    };
    cur.receiptTotal = roundMoney(cur.receiptTotal + row.totalAmount);
    cur.hasReceiptEvents = true;
    map.set(row.purchaseId, cur);
  }

  for (const row of returns) {
    const cur = map.get(row.purchaseId) ?? {
      receiptTotal: 0,
      returnTotal: 0,
      hasReceiptEvents: false,
    };
    cur.returnTotal = roundMoney(cur.returnTotal + row.totalAmount);
    // A return without receipt rows is still an event path for that purchase
    // only when receipts also exist; otherwise leave hasReceiptEvents as-is.
    map.set(row.purchaseId, cur);
  }

  return map;
}
