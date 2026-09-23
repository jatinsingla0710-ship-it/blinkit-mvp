import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_ACTIVITY_UNAVAILABLE_DETAIL,
  CUSTOMER_DOCUMENTS_UNAVAILABLE_DETAIL,
  CUSTOMER_INVITE_ACTION_LABEL,
  CUSTOMER_INVITE_SUCCESS_HINT,
  PREFERRED_PAYMENT_NOT_SET,
  customerHealthOrdersThisMonth,
  mapPaymentStatusFromDb,
  preferredPaymentLabel,
  resolveOrderPaymentStatus,
} from './customers-helpers';

function localIso(year: number, monthIndex: number, day: number): string {
  return new Date(year, monthIndex, day, 12, 0, 0, 0).toISOString();
}

describe('Customers H1 invitation labeling', () => {
  it('does not claim automatic SMS/WhatsApp/email delivery', () => {
    expect(CUSTOMER_INVITE_ACTION_LABEL).toBe('Send activation invite');
    expect(CUSTOMER_INVITE_SUCCESS_HINT.toLowerCase()).toMatch(/otp/);
    expect(CUSTOMER_INVITE_SUCCESS_HINT.toLowerCase()).toMatch(
      /sms is not sent automatically|no sms/,
    );
  });
});

describe('Customers H1 preferred payment honesty', () => {
  it('uses not_set when no stored preference exists', () => {
    expect(PREFERRED_PAYMENT_NOT_SET).toBe('not_set');
    expect(preferredPaymentLabel(PREFERRED_PAYMENT_NOT_SET)).toBe('Not set');
    expect(preferredPaymentLabel(null)).toBe('Not set');
    expect(preferredPaymentLabel('COD')).toBe('COD');
  });
});

describe('Customers H1 order payment status mapping', () => {
  it('maps real payment rows and uses UNKNOWN when missing', () => {
    expect(resolveOrderPaymentStatus('ord-1', [])).toBe('UNKNOWN');
    expect(
      resolveOrderPaymentStatus('ord-1', [
        {
          order_id: 'ord-1',
          status: 'PAID',
          created_at: '2026-08-01T00:00:00.000Z',
        },
      ]),
    ).toBe('PAID');
    expect(
      resolveOrderPaymentStatus('ord-1', [
        {
          order_id: 'ord-1',
          status: 'UNPAID',
          created_at: '2026-08-01T00:00:00.000Z',
        },
        {
          order_id: 'ord-1',
          status: 'PAID',
          created_at: '2026-08-02T00:00:00.000Z',
        },
      ]),
    ).toBe('PAID');
    expect(mapPaymentStatusFromDb('PAYMENT_PENDING')).toBe('PENDING');
    expect(mapPaymentStatusFromDb(null)).toBe('UNKNOWN');
  });
});

describe('Customers H1 health calendar month', () => {
  const now = new Date(2026, 7, 22, 12, 0, 0, 0);

  it('counts and averages only current calendar-month orders', () => {
    const result = customerHealthOrdersThisMonth(
      [
        { created_at: localIso(2026, 7, 5), total: 100 },
        { created_at: localIso(2026, 7, 20), total: 300 },
        { created_at: localIso(2026, 6, 20), total: 999 },
      ],
      now,
    );
    expect(result.ordersThisMonth).toBe(2);
    expect(result.averageOrderValue).toBe(200);
  });
});

describe('Customers H1 deferred empty copy', () => {
  it('states activity/documents are unavailable without inventing GST vault', () => {
    expect(CUSTOMER_ACTIVITY_UNAVAILABLE_DETAIL).toMatch(/not available/i);
    expect(CUSTOMER_DOCUMENTS_UNAVAILABLE_DETAIL).toMatch(/schema|not available/i);
    expect(CUSTOMER_DOCUMENTS_UNAVAILABLE_DETAIL.toLowerCase()).not.toMatch(
      /will appear here/,
    );
  });
});
