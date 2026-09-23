import type {
  ActivationStage,
  ActivationWorkflowState,
  CustomerOrderClass,
} from '@/data/customers-types';

/**
 * Activation rail — business record vs digital access.
 * Primary path: customer logs in with verified mobile OTP and links to shop.
 * Fallback: invitation token after sign-in.
 */
const ACTIVATION_DEFS: {
  state: ActivationWorkflowState;
  label: string;
  detail: string;
}[] = [
  {
    state: 'created',
    label: 'Created',
    detail: 'Shop record created. Orders and delivery can proceed without app login.',
  },
  {
    state: 'invitation_sent',
    label: 'Invitation sent',
    detail:
      'Customer notified to open the app and sign in with their mobile number (OTP). Token link is optional.',
  },
  {
    state: 'activated',
    label: 'Digital access active',
    detail: 'Customer verified mobile OTP and linked to this shop account.',
  },
];

export function buildActivationWorkflow(
  current: ActivationWorkflowState,
  stamps: Partial<Record<ActivationWorkflowState, string>> = {},
): ActivationStage[] {
  const activeIndex = ACTIVATION_DEFS.findIndex((s) => s.state === current);
  return ACTIVATION_DEFS.map((stage, index) => {
    let stateKind: ActivationStage['stateKind'] = 'upcoming';
    if (activeIndex >= 0 && index < activeIndex) stateKind = 'done';
    if (activeIndex >= 0 && index === activeIndex) stateKind = 'current';
    return {
      ...stage,
      stateKind,
      at: stamps[stage.state],
    };
  });
}

/** Map shops.lifecycle_status → activation rail position. */
export function lifecycleToActivation(
  lifecycle: string,
): ActivationWorkflowState {
  switch (lifecycle) {
    case 'LEAD':
      return 'created';
    case 'INVITED':
      return 'invitation_sent';
    case 'ACTIVATED':
    case 'FIRST_ORDER':
    case 'REPEAT_CUSTOMER':
      return 'activated';
    case 'INACTIVE_OR_FOLLOW_UP':
      return 'created';
    default:
      return 'created';
  }
}

/**
 * Derive first/repeat classification from real order count and/or lifecycle.
 * Prefer lifecycle when already FIRST_ORDER/REPEAT_CUSTOMER; else count.
 */
export function deriveCustomerOrderClass(
  lifecycle: string,
  orderCount: number,
): CustomerOrderClass {
  if (lifecycle === 'REPEAT_CUSTOMER' || orderCount >= 2) {
    return 'repeat';
  }
  if (lifecycle === 'FIRST_ORDER' || orderCount === 1) {
    return 'first_order';
  }
  return 'none';
}

export function customerOrderClassLabel(
  classification: CustomerOrderClass,
): string {
  switch (classification) {
    case 'first_order':
      return 'First order customer';
    case 'repeat':
      return 'Repeat customer';
    default:
      return 'No orders yet';
  }
}

/** Pure helpers for accept-lifecycle contract tests (mirrors SQL CASE). */
export function nextLifecycleAfterInvitationAccept(
  current: string,
): string {
  if (current === 'LEAD' || current === 'INVITED') return 'ACTIVATED';
  return current;
}

export function nextLifecycleFromOrderCount(
  current: string,
  orderCount: number,
): string | null {
  if (
    current !== 'ACTIVATED' &&
    current !== 'FIRST_ORDER' &&
    current !== 'REPEAT_CUSTOMER'
  ) {
    return null;
  }
  if (orderCount >= 2) return 'REPEAT_CUSTOMER';
  if (orderCount === 1) return 'FIRST_ORDER';
  return null;
}
