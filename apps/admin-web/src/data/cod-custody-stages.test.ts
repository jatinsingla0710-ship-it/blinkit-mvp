import { describe, expect, it } from 'vitest';
import { managerCustodyPendingAmount } from './dashboard-ops-kpis';

/**
 * Custody stage semantics — Card 5 / Card 6 must not change silently.
 * WITH_DRIVER = Card 6. Manager hold is separate. Owner is final.
 */
function custodyStageLabel(status: string): string {
  switch (status) {
    case 'WITH_DRIVER':
      return 'With Delivery Boy';
    case 'RECEIVED_BY_MANAGER':
    case 'HANDED_TO_COMPANY':
      return 'Received by Manager';
    case 'RECEIVED_BY_OWNER':
    case 'RECONCILED':
      return 'Received by Owner';
    default:
      return status;
  }
}

function card6Includes(status: string): boolean {
  return status === 'WITH_DRIVER';
}

function canJumpToOwner(from: string): boolean {
  return from === 'RECEIVED_BY_MANAGER';
}

describe('COD custody stages', () => {
  it('maps user-facing custody labels', () => {
    expect(custodyStageLabel('WITH_DRIVER')).toBe('With Delivery Boy');
    expect(custodyStageLabel('RECEIVED_BY_MANAGER')).toBe(
      'Received by Manager',
    );
    expect(custodyStageLabel('RECEIVED_BY_OWNER')).toBe('Received by Owner');
  });

  it('Card 6 only counts WITH_DRIVER cash', () => {
    expect(card6Includes('WITH_DRIVER')).toBe(true);
    expect(card6Includes('RECEIVED_BY_MANAGER')).toBe(false);
    expect(card6Includes('RECEIVED_BY_OWNER')).toBe(false);
  });

  it('Card 3 only counts RECEIVED_BY_MANAGER cash', () => {
    expect(
      managerCustodyPendingAmount({
        custodyStatus: 'RECEIVED_BY_MANAGER',
        cashAmount: 1000,
      }),
    ).toBe(1000);
    expect(
      managerCustodyPendingAmount({
        custodyStatus: 'WITH_DRIVER',
        cashAmount: 1000,
      }),
    ).toBe(0);
    expect(
      managerCustodyPendingAmount({
        custodyStatus: 'RECEIVED_BY_OWNER',
        cashAmount: 1000,
      }),
    ).toBe(0);
  });

  it('Manager receipt does not equal Owner receipt', () => {
    expect(canJumpToOwner('WITH_DRIVER')).toBe(false);
    expect(canJumpToOwner('RECEIVED_BY_MANAGER')).toBe(true);
  });

  it('Delivery Boy cannot skip directly to Owner', () => {
    expect(canJumpToOwner('WITH_DRIVER')).toBe(false);
  });
});
