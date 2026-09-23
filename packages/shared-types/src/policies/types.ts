import type { PaymentStatus } from '../payment';
import type { OrderStatus } from '../order';
import type { StaffRole } from '../enums';

export interface OrderTransitionContext {
  paymentStatus: PaymentStatus;
  actorRole: StaffRole;
  /** Trusted server-side business actions only — clients must not set this. */
  isTrustedServerAction: boolean;
}

export interface TransitionResult {
  allowed: boolean;
  reason?: string;
}

export interface OrderTransitionPolicy {
  canTransition(
    from: OrderStatus,
    to: OrderStatus,
    context: OrderTransitionContext
  ): TransitionResult;
}

export interface PaymentTransitionContext {
  actorRole: StaffRole;
  isTrustedServerAction: boolean;
  orderStatus?: OrderStatus;
}

export interface PaymentTransitionPolicy {
  canTransition(
    from: PaymentStatus,
    to: PaymentStatus,
    context: PaymentTransitionContext
  ): TransitionResult;
}
