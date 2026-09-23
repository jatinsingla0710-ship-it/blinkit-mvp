import { describe, expect, it } from 'vitest';
import {
  buildActivationWorkflow,
  customerOrderClassLabel,
  deriveCustomerOrderClass,
  lifecycleToActivation,
  nextLifecycleAfterInvitationAccept,
  nextLifecycleFromOrderCount,
} from './customer-helpers';

describe('Customers H2 invitation accept lifecycle', () => {
  it('promotes LEAD/INVITED to ACTIVATED on successful accept', () => {
    expect(nextLifecycleAfterInvitationAccept('LEAD')).toBe('ACTIVATED');
    expect(nextLifecycleAfterInvitationAccept('INVITED')).toBe('ACTIVATED');
  });

  it('does not demote already-activated shops', () => {
    expect(nextLifecycleAfterInvitationAccept('ACTIVATED')).toBe('ACTIVATED');
    expect(nextLifecycleAfterInvitationAccept('FIRST_ORDER')).toBe(
      'FIRST_ORDER',
    );
    expect(nextLifecycleAfterInvitationAccept('REPEAT_CUSTOMER')).toBe(
      'REPEAT_CUSTOMER',
    );
  });
});

describe('Customers H2 order classification', () => {
  it('advances FIRST_ORDER / REPEAT only after ACTIVATED', () => {
    expect(nextLifecycleFromOrderCount('INVITED', 1)).toBeNull();
    expect(nextLifecycleFromOrderCount('LEAD', 5)).toBeNull();
    expect(nextLifecycleFromOrderCount('ACTIVATED', 1)).toBe('FIRST_ORDER');
    expect(nextLifecycleFromOrderCount('FIRST_ORDER', 2)).toBe(
      'REPEAT_CUSTOMER',
    );
  });

  it('derives UI class from lifecycle and order count', () => {
    expect(deriveCustomerOrderClass('ACTIVATED', 0)).toBe('none');
    expect(deriveCustomerOrderClass('ACTIVATED', 1)).toBe('first_order');
    expect(deriveCustomerOrderClass('FIRST_ORDER', 1)).toBe('first_order');
    expect(deriveCustomerOrderClass('REPEAT_CUSTOMER', 1)).toBe('repeat');
    expect(deriveCustomerOrderClass('ACTIVATED', 3)).toBe('repeat');
    expect(customerOrderClassLabel('first_order')).toMatch(/First order/i);
  });
});

describe('Customers H2 activation rail', () => {
  it('maps lifecycle without a separate OTP stage in the rail', () => {
    expect(lifecycleToActivation('LEAD')).toBe('created');
    expect(lifecycleToActivation('INVITED')).toBe('invitation_sent');
    expect(lifecycleToActivation('ACTIVATED')).toBe('activated');
    expect(lifecycleToActivation('FIRST_ORDER')).toBe('activated');

    const stages = buildActivationWorkflow('invitation_sent');
    expect(stages.map((s) => s.state)).toEqual([
      'created',
      'invitation_sent',
      'activated',
    ]);
    expect(stages.some((s) => (s.state as string) === 'otp_verified')).toBe(
      false,
    );
    expect(stages.find((s) => s.state === 'invitation_sent')?.detail).toMatch(
      /mobile|otp/i,
    );
  });

  it('marks prior stages done when activated', () => {
    const stages = buildActivationWorkflow('activated');
    expect(stages[0]?.stateKind).toBe('done');
    expect(stages[1]?.stateKind).toBe('done');
    expect(stages[2]?.stateKind).toBe('current');
  });
});
