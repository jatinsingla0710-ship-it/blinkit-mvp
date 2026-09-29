import type { PaymentStatusVm, PreferredPaymentVm } from '@/data/customers-types';
import { countOrdersInCalendarMonth, sumOrderRevenueInCalendarMonth } from '@/data/salesmen-helpers';

/** No preferred-payment column on shops — live path must not invent COD. */
export const PREFERRED_PAYMENT_NOT_SET: PreferredPaymentVm = 'not_set';

export function preferredPaymentLabel(
  payment: PreferredPaymentVm | null | undefined,
): string {
  if (!payment || payment === 'not_set') return 'Not set';
  return payment;
}

/** Map a payments.status value when a row exists. */
export function mapPaymentStatusFromDb(
  status: string | null | undefined,
): PaymentStatusVm {
  switch ((status ?? '').toUpperCase()) {
    case 'PAID':
    case 'CAPTURED':
      return 'PAID';
    case 'PAYMENT_PENDING':
    case 'PENDING':
      return 'PENDING';
    case 'PARTIAL':
      return 'PARTIAL';
    case 'REFUNDED':
      return 'REFUNDED';
    case 'UNPAID':
    case 'FAILED':
      return 'UNPAID';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Resolve order payment status from related payment rows.
 * No payment row → UNKNOWN (not fake UNPAID).
 * Prefer PAID if any; else latest by created_at.
 */
export function resolveOrderPaymentStatus(
  orderId: string,
  payments: ReadonlyArray<{
    order_id?: string | null;
    status?: string | null;
    created_at?: string | null;
  }>,
): PaymentStatusVm {
  const forOrder = payments.filter(
    (p) => (p.order_id ?? '').trim() === orderId,
  );
  if (forOrder.length === 0) return 'UNKNOWN';

  const mapped = forOrder.map((p) => ({
    status: mapPaymentStatusFromDb(p.status),
    at: p.created_at ?? '',
  }));
  if (mapped.some((p) => p.status === 'PAID')) return 'PAID';
  if (mapped.some((p) => p.status === 'REFUNDED')) return 'REFUNDED';
  mapped.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return mapped[0]?.status ?? 'UNKNOWN';
}

export function customerHealthOrdersThisMonth(
  orders: ReadonlyArray<{ created_at?: string | null; total?: number | null }>,
  now: Date = new Date(),
): { ordersThisMonth: number; averageOrderValue: number } {
  const ordersThisMonth = countOrdersInCalendarMonth(orders, now);
  const revenue = sumOrderRevenueInCalendarMonth(orders, now);
  return {
    ordersThisMonth,
    averageOrderValue: ordersThisMonth > 0 ? revenue / ordersThisMonth : 0,
  };
}

/** @deprecated Kept for Admin contract tests. Not shown in active Admin or Sales UI. */
export const CUSTOMER_INVITE_ACTION_LABEL = 'Send activation invite';
export const CUSTOMER_INVITE_PENDING_LABEL = 'Sending…';

export const CUSTOMER_INVITE_SUCCESS_HINT =
  'Invitation recorded. Ask the customer to open the app, enter their mobile number, and verify OTP. Share the login link manually if needed — SMS is not sent automatically.';

export const CUSTOMER_ACTIVITY_UNAVAILABLE_DETAIL =
  'Customer activity timeline is not available yet — there is no live activity feed for shops in Admin. Orders and payments appear on their own tabs.';

export const CUSTOMER_DOCUMENTS_UNAVAILABLE_DETAIL =
  'Customer documents are not available yet — no document store exists in the current schema (GST / license uploads deferred).';
