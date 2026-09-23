import { describe, expect, it } from 'vitest';
import {
  canTransitionOrder,
  getAllowedOrderTransitions,
} from './order-transitions';
import type { OrderTransitionContext } from './types';
import type { OrderStatus } from '../order';

const trustedAdminContext = (
  paymentStatus: OrderTransitionContext['paymentStatus']
): OrderTransitionContext => ({
  paymentStatus,
  actorRole: 'ADMIN',
  isTrustedServerAction: true,
});

describe('order transition policy', () => {
  it('rejects UNPAID order transition to DELIVERED', () => {
    const result = canTransitionOrder(
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      trustedAdminContext('UNPAID')
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('PAID');
  });

  it('allows PAID eligible OUT_FOR_DELIVERY order to transition to DELIVERED', () => {
    const result = canTransitionOrder(
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      trustedAdminContext('PAID')
    );
    expect(result.allowed).toBe(true);
  });

  it('rejects invalid order status jumps', () => {
    const result = canTransitionOrder(
      'DRAFT_ASSISTED',
      'DELIVERED',
      trustedAdminContext('PAID')
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Invalid order transition');
  });

  it('rejects client-side transition attempts', () => {
    const result = canTransitionOrder('CONFIRMED', 'STOCK_RESERVED', {
      paymentStatus: 'UNPAID',
      actorRole: 'CUSTOMER',
      isTrustedServerAction: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('trusted server-side');
  });

  it('exposes allowed transitions from CONFIRMED', () => {
    expect(getAllowedOrderTransitions('CONFIRMED')).toEqual([
      'STOCK_RESERVED',
      'CANCELLED',
    ]);
  });

  it('does not allow transitions out of DELIVERED', () => {
    const allowed: OrderStatus[] = [...getAllowedOrderTransitions('DELIVERED')];
    expect(allowed).toHaveLength(0);
  });
});
