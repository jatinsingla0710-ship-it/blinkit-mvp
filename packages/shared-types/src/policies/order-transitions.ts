import type { OrderStatus } from '../order';
import type {
  OrderTransitionContext,
  OrderTransitionPolicy,
  TransitionResult,
} from './types';

const ORDER_TRANSITION_GRAPH: Record<OrderStatus, readonly OrderStatus[]> = {
  DRAFT_ASSISTED: ['AWAITING_CUSTOMER_CONFIRMATION', 'CANCELLED'],
  AWAITING_CUSTOMER_CONFIRMATION: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['STOCK_RESERVED', 'CANCELLED'],
  STOCK_RESERVED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['READY_FOR_DISPATCH', 'CANCELLED'],
  READY_FOR_DISPATCH: ['ASSIGNED_TO_ROUTE', 'CANCELLED'],
  ASSIGNED_TO_ROUTE: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'DELIVERY_FAILED'],
  DELIVERED: [],
  DELIVERY_FAILED: ['CANCELLED'],
  CANCELLED: [],
};

function reject(reason: string): TransitionResult {
  return { allowed: false, reason };
}

function allow(): TransitionResult {
  return { allowed: true };
}

export class DefaultOrderTransitionPolicy implements OrderTransitionPolicy {
  canTransition(
    from: OrderStatus,
    to: OrderStatus,
    context: OrderTransitionContext
  ): TransitionResult {
    if (from === to) {
      return allow();
    }

    if (!context.isTrustedServerAction) {
      return reject(
        'Order status transitions must be performed by trusted server-side business actions'
      );
    }

    const allowedTargets = ORDER_TRANSITION_GRAPH[from];
    if (!allowedTargets.includes(to)) {
      return reject(`Invalid order transition from ${from} to ${to}`);
    }

    if (to === 'DELIVERED' && context.paymentStatus !== 'PAID') {
      return reject(
        'Order cannot transition to DELIVERED unless payment status is PAID'
      );
    }

    if (to === 'DELIVERED' && from !== 'OUT_FOR_DELIVERY') {
      return reject('Order can only transition to DELIVERED from OUT_FOR_DELIVERY');
    }

    return allow();
  }
}

export const defaultOrderTransitionPolicy = new DefaultOrderTransitionPolicy();

export function canTransitionOrder(
  from: OrderStatus,
  to: OrderStatus,
  context: OrderTransitionContext
): TransitionResult {
  return defaultOrderTransitionPolicy.canTransition(from, to, context);
}

export function getAllowedOrderTransitions(from: OrderStatus): readonly OrderStatus[] {
  return ORDER_TRANSITION_GRAPH[from];
}
