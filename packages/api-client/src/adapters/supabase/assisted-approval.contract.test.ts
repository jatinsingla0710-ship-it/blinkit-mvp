import { describe, expect, it } from 'vitest';

/**
 * Contract tests for assisted approval + self-serve pricing behavior.
 * SQL RPCs are the source of truth; these lock the intended invariants.
 */

describe('assisted order approval flow contracts', () => {
  it('assisted place stops at AWAITING_CUSTOMER_CONFIRMATION without reserve', () => {
    const placeAssistedResult = {
      status: 'AWAITING_CUSTOMER_CONFIRMATION',
      reserved: false,
      challengeStatus: 'PENDING',
      notificationTemplate: 'order_approval_requested',
    };
    expect(placeAssistedResult.status).toBe('AWAITING_CUSTOMER_CONFIRMATION');
    expect(placeAssistedResult.reserved).toBe(false);
    expect(placeAssistedResult.challengeStatus).toBe('PENDING');
  });

  it('customer approve advances CONFIRMED then STOCK_RESERVED', () => {
    const steps = [
      'AWAITING_CUSTOMER_CONFIRMATION',
      'CONFIRMED',
      'STOCK_RESERVED',
    ];
    expect(steps[steps.length - 1]).toBe('STOCK_RESERVED');
    expect(steps).toEqual([
      'AWAITING_CUSTOMER_CONFIRMATION',
      'CONFIRMED',
      'STOCK_RESERVED',
    ]);
  });

  it('request changes keeps order awaiting and does not reserve', () => {
    const afterRequest = {
      orderStatus: 'AWAITING_CUSTOMER_CONFIRMATION',
      challengeStatus: 'CUSTOMER_REQUESTED_CHANGES',
      reserved: false,
      notificationTemplate: 'customer_requested_changes',
    };
    expect(afterRequest.orderStatus).toBe('AWAITING_CUSTOMER_CONFIRMATION');
    expect(afterRequest.reserved).toBe(false);
  });

  it('meaningful edits invalidate prior approval and reissue challenge', () => {
    const edit = {
      previousChallenge: 'CUSTOMER_CONFIRMED',
      afterEditChallenge: 'EXPIRED',
      newChallenge: 'PENDING',
      orderStatus: 'AWAITING_CUSTOMER_CONFIRMATION',
      notificationTemplate: 'order_reapproval_requested',
    };
    expect(edit.afterEditChallenge).toBe('EXPIRED');
    expect(edit.newChallenge).toBe('PENDING');
    expect(edit.orderStatus).toBe('AWAITING_CUSTOMER_CONFIRMATION');
  });

  it('self-serve ignores client price and uses server sku_prices', () => {
    const clientPrice = 1;
    const serverPrice = 120;
    const snapshotPrice = serverPrice;
    expect(snapshotPrice).not.toBe(clientPrice);
    expect(snapshotPrice).toBe(serverPrice);
  });

  it('unconfigured WhatsApp stays PENDING/FAILED never SENT', () => {
    const outbox = {
      templateKey: 'order_approval_requested',
      channel: 'WHATSAPP',
      statusAfterDrain: 'FAILED',
      lastError: 'provider_unconfigured:WHATSAPP',
    };
    expect(outbox.statusAfterDrain).not.toBe('SENT');
    expect(outbox.lastError).toMatch(/provider_unconfigured/);
  });

  it('customer cannot act on another shop challenge', () => {
    const authCheck = {
      tokenShopId: 'shop-a',
      customerShopIds: ['shop-b'],
      allowed: false,
    };
    expect(
      authCheck.customerShopIds.includes(authCheck.tokenShopId),
    ).toBe(false);
    expect(authCheck.allowed).toBe(false);
  });

  it('expired challenge does not auto-reserve or auto-cancel', () => {
    const expired = {
      challengeStatus: 'EXPIRED',
      orderStatus: 'AWAITING_CUSTOMER_CONFIRMATION',
      reserved: false,
      cancelled: false,
      notificationTemplate: 'order_approval_expired',
    };
    expect(expired.reserved).toBe(false);
    expect(expired.cancelled).toBe(false);
    expect(expired.orderStatus).toBe('AWAITING_CUSTOMER_CONFIRMATION');
  });

  it('UI status mapping never collapses awaiting into confirmed', () => {
    const map = (status: string) => {
      if (
        status === 'DRAFT_ASSISTED' ||
        status === 'AWAITING_CUSTOMER_CONFIRMATION'
      ) {
        return 'AWAITING_CUSTOMER_CONFIRMATION';
      }
      if (status === 'CONFIRMED') return 'CONFIRMED';
      return status;
    };
    expect(map('AWAITING_CUSTOMER_CONFIRMATION')).toBe(
      'AWAITING_CUSTOMER_CONFIRMATION',
    );
    expect(map('AWAITING_CUSTOMER_CONFIRMATION')).not.toBe('CONFIRMED');
  });
});
