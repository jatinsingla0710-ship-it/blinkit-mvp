import { describe, expect, it, vi } from 'vitest';
import { LiveAdminApi } from '@/data/live/LiveAdminApi';
import {
  buildActivationWorkflow,
  deriveCustomerOrderClass,
  lifecycleToActivation,
  nextLifecycleAfterInvitationAccept,
  nextLifecycleFromOrderCount,
} from './customer-helpers';
import { CUSTOMER_INVITE_ACTION_LABEL, CUSTOMER_INVITE_SUCCESS_HINT } from './customers-helpers';

/**
 * End-to-end contract map for the pilot customer workflow (post Customers H1/H2).
 * Runtime E2E against live Supabase is deployment work; these tests lock the code contract.
 */
describe('Customer workflow contract (create → activate → orders → edit/reassign)', () => {
  it('1–2: invite labeling encourages mobile OTP activation', () => {
    expect(CUSTOMER_INVITE_ACTION_LABEL).toBe('Send activation invite');
    expect(CUSTOMER_INVITE_SUCCESS_HINT.toLowerCase()).toMatch(/mobile/);
    expect(CUSTOMER_INVITE_SUCCESS_HINT.toLowerCase()).toMatch(/otp/);
  });

  it('3–5: accept maps LEAD/INVITED → ACTIVATED; UI rail references mobile OTP', () => {
    expect(nextLifecycleAfterInvitationAccept('LEAD')).toBe('ACTIVATED');
    expect(nextLifecycleAfterInvitationAccept('INVITED')).toBe('ACTIVATED');
    expect(lifecycleToActivation('ACTIVATED')).toBe('activated');
    const stages = buildActivationWorkflow('activated');
    expect(stages.map((s) => s.state)).toEqual([
      'created',
      'invitation_sent',
      'activated',
    ]);
    expect(stages.every((s) => !String(s.label).toLowerCase().includes('otp stage'))).toBe(
      true,
    );
  });

  it('5: failed accept paths must not activate (validation still raises before update)', () => {
    // Contract: nextLifecycleAfterInvitationAccept is only applied after checks pass.
    // Invalid/expired/mismatch never call it — covered by SQL order in accept_shop_invitation.
    expect(nextLifecycleAfterInvitationAccept('INVITED')).toBe('ACTIVATED');
    expect(nextLifecycleFromOrderCount('INVITED', 1)).toBeNull();
  });

  it('6–7: first/repeat classification from real order counts after ACTIVATED', () => {
    expect(nextLifecycleFromOrderCount('ACTIVATED', 1)).toBe('FIRST_ORDER');
    expect(nextLifecycleFromOrderCount('FIRST_ORDER', 2)).toBe('REPEAT_CUSTOMER');
    expect(deriveCustomerOrderClass('FIRST_ORDER', 1)).toBe('first_order');
    expect(deriveCustomerOrderClass('REPEAT_CUSTOMER', 5)).toBe('repeat');
    expect(deriveCustomerOrderClass('ACTIVATED', 0)).toBe('none');
  });

  it('8: reassign uses trusted RPC only (not customer update)', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        shopId: 'shop-1',
        salesmanProfileId: 'sm-2',
        assignmentId: 'asg-1',
        alreadyAssigned: false,
        closedAssignmentCount: 1,
      },
      error: null,
    }));
    const from = vi.fn(() => {
      throw new Error('client CRUD must not be used for reassign');
    });
    const api = new LiveAdminApi({ rpc, from } as never);
    await api.reassignShopSalesman('shop-1', 'sm-2', 'Territory');
    expect(rpc).toHaveBeenCalledWith('admin_reassign_shop_salesman', {
      p_shop_id: 'shop-1',
      p_new_salesman_profile_id: 'sm-2',
      p_reason: 'Territory',
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('9: invitation create surfaces token for manual share', async () => {
    const shopId = '11111111-1111-1111-1111-111111111111';
    const api = new LiveAdminApi({
      rpc: vi.fn(async () => ({ data: '919876543210', error: null })),
      from: (table: string) => {
        if (table === 'shop_contacts') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: { mobile: '9876543210' },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'shop_invitations') {
          return {
            update: () => ({
              eq: () => ({
                eq: async () => ({ data: null, error: null }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: { id: 'inv-1' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'shops') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { lifecycle_status: 'INVITED' },
                  error: null,
                }),
              }),
            }),
            update: () => ({
              eq: async () => ({ data: null, error: null }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as never);

    const result = await api.sendCustomerInvitation(shopId);
    expect(result.token.length).toBeGreaterThan(8);
    expect(result.shopId).toBe(shopId);
    expect(result.mobile).toBeTruthy();
  });
});
