/**
 * Phase 16 — payment proof extract DTO + matching helpers.
 * Default extractor is manual/stub. Never claim AI accuracy.
 * Confirm marks an order paid only after owner picks the order.
 */

import {
  matchCustomerFromHints,
  type CustomerMatchCandidate,
} from '@/data/day-book-extract';
import { orderOutstandingResidual } from '@/data/customer-ledger';

export type PaymentProofCollectionMethod =
  | 'UPI_ON_DELIVERY'
  | 'CASH_ON_DELIVERY'
  | 'CARD_ON_DELIVERY'
  | 'ONLINE_GATEWAY'
  | 'OTHER';

export type PaymentProofExtractDraft = {
  amount?: number | null;
  paymentDate?: string | null;
  referenceNumber?: string | null;
  senderHint?: string | null;
  matchedCustomerId?: string | null;
  matchedCustomerName?: string | null;
  customerMatchConfidence?: 'exact' | 'partial' | 'none';
  matchedOrderId?: string | null;
  orderMatchConfidence?: 'exact' | 'partial' | 'none';
  collectionMethod?: PaymentProofCollectionMethod | null;
  notes?: string | null;
  /** Honest label — never "AI verified". */
  extractorLabel: string;
};

export type UnpaidOrderCandidate = {
  orderId: string;
  shopId: string;
  total: number;
  outstanding: number;
  status: string;
  createdAtLabel: string;
  shortLabel: string;
};

export type PaymentProofScanStatus =
  | 'UPLOADED'
  | 'REVIEWING'
  | 'CONFIRMED'
  | 'DISCARDED';

export type PaymentProofScanVm = {
  id: string;
  status: PaymentProofScanStatus;
  imagePath: string | null;
  imageUrl: string | null;
  extract: PaymentProofExtractDraft;
  extractorLabel: string;
  orderId: string | null;
  shopId: string | null;
  notes: string | null;
  createdAtLabel: string;
};

export function emptyPaymentProofExtract(
  extractorLabel = 'manual',
): PaymentProofExtractDraft {
  return {
    amount: null,
    paymentDate: null,
    referenceNumber: null,
    senderHint: null,
    matchedCustomerId: null,
    matchedCustomerName: null,
    customerMatchConfidence: 'none',
    matchedOrderId: null,
    orderMatchConfidence: 'none',
    collectionMethod: 'UPI_ON_DELIVERY',
    notes: null,
    extractorLabel,
  };
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function matchCollectionMethodFromHint(
  hint: string | null | undefined,
): PaymentProofCollectionMethod {
  const raw = normalize(hint);
  if (!raw) return 'UPI_ON_DELIVERY';
  if (/\b(cash|cod)\b/.test(raw)) return 'CASH_ON_DELIVERY';
  if (/\b(card|pos)\b/.test(raw)) return 'CARD_ON_DELIVERY';
  if (/\b(gateway|razorpay|online)\b/.test(raw)) return 'ONLINE_GATEWAY';
  if (/\b(upi|gpay|phonepe|paytm|bhim)\b/.test(raw)) return 'UPI_ON_DELIVERY';
  return 'OTHER';
}

/**
 * Pick unpaid order candidates whose outstanding matches the proof amount.
 * Exact = within ₹1; partial = single unpaid order for the customer when amount missing.
 */
export function matchOrderFromAmount(
  orders: readonly UnpaidOrderCandidate[],
  amount: number | null | undefined,
): {
  matchedOrderId: string | null;
  orderMatchConfidence: 'exact' | 'partial' | 'none';
} {
  const unpaid = orders.filter((o) => o.outstanding > 0);
  if (!unpaid.length) {
    return { matchedOrderId: null, orderMatchConfidence: 'none' };
  }

  if (amount != null && amount > 0) {
    const exact = unpaid.filter(
      (o) => Math.abs(o.outstanding - amount) < 1.005,
    );
    if (exact.length === 1) {
      return {
        matchedOrderId: exact[0]!.orderId,
        orderMatchConfidence: 'exact',
      };
    }
    if (exact.length > 1) {
      return { matchedOrderId: null, orderMatchConfidence: 'none' };
    }
  }

  if (unpaid.length === 1) {
    return {
      matchedOrderId: unpaid[0]!.orderId,
      orderMatchConfidence: 'partial',
    };
  }

  return { matchedOrderId: null, orderMatchConfidence: 'none' };
}

export function applyPaymentProofMatches(
  extract: PaymentProofExtractDraft,
  customers: readonly CustomerMatchCandidate[],
  unpaidOrders: readonly UnpaidOrderCandidate[],
): PaymentProofExtractDraft {
  const customerMatch = matchCustomerFromHints(customers, {
    name: extract.senderHint,
  });
  const shopOrders = customerMatch.matchedCustomerId
    ? unpaidOrders.filter((o) => o.shopId === customerMatch.matchedCustomerId)
    : unpaidOrders;
  const orderMatch = matchOrderFromAmount(shopOrders, extract.amount ?? null);

  return {
    ...extract,
    matchedCustomerId:
      customerMatch.matchedCustomerId ?? extract.matchedCustomerId ?? null,
    matchedCustomerName:
      customerMatch.matchedCustomerName ?? extract.matchedCustomerName ?? null,
    customerMatchConfidence: customerMatch.customerMatchConfidence,
    matchedOrderId: orderMatch.matchedOrderId ?? extract.matchedOrderId ?? null,
    orderMatchConfidence: orderMatch.orderMatchConfidence,
  };
}

export async function runManualPaymentProofExtractor(_input: {
  imageFileName?: string | null;
}): Promise<PaymentProofExtractDraft> {
  return emptyPaymentProofExtract('manual');
}

export function parsePaymentProofExtractJson(
  raw: unknown,
): PaymentProofExtractDraft {
  if (!raw || typeof raw !== 'object') return emptyPaymentProofExtract();
  const row = raw as Record<string, unknown>;
  const methodRaw =
    typeof row.collectionMethod === 'string' ? row.collectionMethod : null;
  const collectionMethod: PaymentProofCollectionMethod =
    methodRaw === 'CASH_ON_DELIVERY' ||
    methodRaw === 'CARD_ON_DELIVERY' ||
    methodRaw === 'ONLINE_GATEWAY' ||
    methodRaw === 'OTHER' ||
    methodRaw === 'UPI_ON_DELIVERY'
      ? methodRaw
      : 'UPI_ON_DELIVERY';

  return {
    amount:
      row.amount == null || row.amount === ''
        ? null
        : Number(row.amount) || null,
    paymentDate:
      typeof row.paymentDate === 'string' ? row.paymentDate.slice(0, 10) : null,
    referenceNumber:
      typeof row.referenceNumber === 'string' ? row.referenceNumber : null,
    senderHint: typeof row.senderHint === 'string' ? row.senderHint : null,
    matchedCustomerId:
      typeof row.matchedCustomerId === 'string'
        ? row.matchedCustomerId
        : null,
    matchedCustomerName:
      typeof row.matchedCustomerName === 'string'
        ? row.matchedCustomerName
        : null,
    customerMatchConfidence:
      row.customerMatchConfidence === 'exact' ||
      row.customerMatchConfidence === 'partial' ||
      row.customerMatchConfidence === 'none'
        ? row.customerMatchConfidence
        : 'none',
    matchedOrderId:
      typeof row.matchedOrderId === 'string' ? row.matchedOrderId : null,
    orderMatchConfidence:
      row.orderMatchConfidence === 'exact' ||
      row.orderMatchConfidence === 'partial' ||
      row.orderMatchConfidence === 'none'
        ? row.orderMatchConfidence
        : 'none',
    collectionMethod,
    notes: typeof row.notes === 'string' ? row.notes : null,
    extractorLabel:
      typeof row.extractorLabel === 'string' && row.extractorLabel.trim()
        ? row.extractorLabel
        : 'manual',
  };
}

/** Map DB order+payment rows into unpaid candidates for matching. */
export function buildUnpaidOrderCandidates(
  orders: readonly {
    id: string;
    shopId: string;
    status: string;
    total: number;
    createdAt: string;
  }[],
  paymentsByOrderId: Map<
    string,
    {
      status: string;
      cash_collected_amount?: number | null;
      online_collected_amount?: number | null;
    }
  >,
  formatDateTime: (iso: string) => string,
  shortCode: (id: string) => string,
): UnpaidOrderCandidate[] {
  return orders
    .map((order) => {
      const payment = paymentsByOrderId.get(order.id) ?? null;
      const outstanding = orderOutstandingResidual(
        { status: order.status, total: order.total },
        payment,
      );
      return {
        orderId: order.id,
        shopId: order.shopId,
        total: order.total,
        outstanding,
        status: order.status,
        createdAtLabel: formatDateTime(order.createdAt),
        shortLabel: `${shortCode(order.id)} · ₹${outstanding.toFixed(0)} due`,
      };
    })
    .filter((o) => o.outstanding > 0);
}
