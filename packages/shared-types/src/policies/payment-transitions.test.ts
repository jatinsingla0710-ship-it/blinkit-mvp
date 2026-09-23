import { describe, expect, it } from 'vitest';
import {
  canTransitionPayment,
  getAllowedPaymentTransitions,
} from './payment-transitions';
import type { PaymentTransitionContext } from './types';

const trustedContext = (): PaymentTransitionContext => ({
  actorRole: 'ADMIN',
  isTrustedServerAction: true,
});

describe('payment transition policy', () => {
  it('rejects invalid payment status jumps', () => {
    const result = canTransitionPayment('UNPAID', 'REFUNDED', trustedContext());
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Invalid payment transition');
  });

  it('allows UNPAID to PAYMENT_PENDING', () => {
    const result = canTransitionPayment(
      'UNPAID',
      'PAYMENT_PENDING',
      trustedContext()
    );
    expect(result.allowed).toBe(true);
  });

  it('allows PAYMENT_PENDING to PAID', () => {
    const result = canTransitionPayment('PAYMENT_PENDING', 'PAID', trustedContext());
    expect(result.allowed).toBe(true);
  });

  it('rejects client-side payment transition attempts', () => {
    const result = canTransitionPayment('UNPAID', 'PAID', {
      actorRole: 'CUSTOMER',
      isTrustedServerAction: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('trusted server-side');
  });

  it('does not allow transitions out of REFUNDED', () => {
    expect(getAllowedPaymentTransitions('REFUNDED')).toHaveLength(0);
  });
});
