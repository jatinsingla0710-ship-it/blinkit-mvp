import type { PaymentStatus } from '../payment';
import type {
  PaymentTransitionContext,
  PaymentTransitionPolicy,
  TransitionResult,
} from './types';

const PAYMENT_TRANSITION_GRAPH: Record<PaymentStatus, readonly PaymentStatus[]> = {
  UNPAID: ['PAYMENT_PENDING', 'PAID', 'FAILED'],
  PAYMENT_PENDING: ['PAID', 'FAILED'],
  PAID: ['REFUNDED'],
  FAILED: ['PAYMENT_PENDING', 'UNPAID'],
  REFUNDED: [],
};

function reject(reason: string): TransitionResult {
  return { allowed: false, reason };
}

function allow(): TransitionResult {
  return { allowed: true };
}

export class DefaultPaymentTransitionPolicy implements PaymentTransitionPolicy {
  canTransition(
    from: PaymentStatus,
    to: PaymentStatus,
    context: PaymentTransitionContext
  ): TransitionResult {
    if (from === to) {
      return allow();
    }

    if (!context.isTrustedServerAction) {
      return reject(
        'Payment status transitions must be performed by trusted server-side business actions'
      );
    }

    const allowedTargets = PAYMENT_TRANSITION_GRAPH[from];
    if (!allowedTargets.includes(to)) {
      return reject(`Invalid payment transition from ${from} to ${to}`);
    }

    return allow();
  }
}

export const defaultPaymentTransitionPolicy = new DefaultPaymentTransitionPolicy();

export function canTransitionPayment(
  from: PaymentStatus,
  to: PaymentStatus,
  context: PaymentTransitionContext
): TransitionResult {
  return defaultPaymentTransitionPolicy.canTransition(from, to, context);
}

export function getAllowedPaymentTransitions(
  from: PaymentStatus
): readonly PaymentStatus[] {
  return PAYMENT_TRANSITION_GRAPH[from];
}
