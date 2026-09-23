/**
 * COD helpers aligned with delivery_complete_route / Sprint 8 payment rules.
 * Expected = PAY_ON_DELIVERY or on-delivery collection_method.
 */

export type PaymentLike = {
  id?: unknown;
  order_id?: unknown;
  method_intent?: unknown;
  collection_method?: unknown;
  status?: unknown;
  amount?: unknown;
  paid_at?: unknown;
};

export function isOnDeliveryPayment(payment: PaymentLike): boolean {
  const intent = String(payment.method_intent ?? '');
  const method = String(payment.collection_method ?? '');
  return (
    intent === 'PAY_ON_DELIVERY' ||
    method === 'CASH_ON_DELIVERY' ||
    method === 'UPI_ON_DELIVERY' ||
    method === 'CARD_ON_DELIVERY'
  );
}

export function paymentTypeLabelFromPayment(
  payment: PaymentLike | null | undefined,
): string {
  if (!payment) return '—';
  const intent = String(payment.method_intent ?? '');
  const status = String(payment.status ?? '');
  const paid = status === 'PAID';
  if (intent === 'PAY_ON_DELIVERY' || isOnDeliveryPayment(payment)) {
    return paid ? 'COD (paid)' : 'COD';
  }
  if (intent === 'PAY_ONLINE_NOW') {
    return paid ? 'Online (paid)' : 'Online';
  }
  return intent || '—';
}

export function isCodCollectable(payment: PaymentLike | null | undefined): boolean {
  if (!payment) return false;
  if (!isOnDeliveryPayment(payment)) return false;
  return String(payment.status ?? '') !== 'PAID';
}

export function summarizeCodFromPayments(payments: PaymentLike[]): {
  expected: number;
  collected: number;
  pending: number;
} {
  let expected = 0;
  let collected = 0;
  for (const p of payments) {
    if (!isOnDeliveryPayment(p)) continue;
    const amount = Number(p.amount ?? 0);
    if (!Number.isFinite(amount)) continue;
    expected += amount;
    if (String(p.status ?? '') === 'PAID') collected += amount;
  }
  return {
    expected,
    collected,
    pending: Math.max(expected - collected, 0),
  };
}

export function collectionMethodLabel(method: string): string {
  switch (method) {
    case 'CASH_ON_DELIVERY':
      return 'Cash';
    case 'UPI_ON_DELIVERY':
      return 'UPI';
    case 'CARD_ON_DELIVERY':
      return 'Card';
    case 'ONLINE_GATEWAY':
      return 'Online';
    case 'OTHER':
      return 'Other';
    default:
      return method || '—';
  }
}
