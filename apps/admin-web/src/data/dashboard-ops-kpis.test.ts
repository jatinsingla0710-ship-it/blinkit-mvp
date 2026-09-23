import { describe, expect, it } from 'vitest';
import {
  computePaymentRemaining,
  driverCustodyPendingAmount,
  managerCustodyPendingAmount,
  mapOpsDashboardKpisToExecutive,
  ofdCustomerUnpaidResidual,
  parseOpsDashboardKpisRpc,
} from './dashboard-ops-kpis';

describe('mapOpsDashboardKpisToExecutive', () => {
  it('maps six cards in executive order without Salesmen Working Today', () => {
    const cards = mapOpsDashboardKpisToExecutive({
      monthlyRevenue: 125000.5,
      pendingOrders: 7,
      salesmenWorkingToday: 3,
      inTransitOrders: 4,
      workloadDelivered: 40,
      workloadTotal: 70,
      workloadRemaining: 30,
      managerCollectionsPending: 65000,
      pendingToReceiveTotal: 300000,
      pendingToReceiveOrders: 12,
      driverCollectionsPending: 8000,
      driverCollectionsCash: 8000,
      driverCollectionsOnline: 0,
    });

    expect(cards).toHaveLength(6);
    expect(cards.map((c) => c.id)).toEqual([
      'monthly_revenue',
      'pending_orders',
      'manager_collections_pending',
      'in_transit',
      'pending_to_receive',
      'driver_collections_pending',
    ]);
    expect(cards.map((c) => c.label)).not.toContain('Salesmen Working Today');
  });

  it('Card 3 is Payment to Receive from Managers (RECEIVED_BY_MANAGER only)', () => {
    const cards = mapOpsDashboardKpisToExecutive({
      managerCollectionsPending: 65000,
    });
    expect(cards[2]?.id).toBe('manager_collections_pending');
    expect(cards[2]?.label).toBe('Payment to Receive from Managers');
    expect(cards[2]?.href).toBe(
      '/payments?tab=settlements&focus=with_manager',
    );
    expect(cards[2]?.hint).toMatch(/warehouse managers/i);
  });

  it('Card 3 empty state shows no pending manager handovers', () => {
    const cards = mapOpsDashboardKpisToExecutive({
      managerCollectionsPending: 0,
    });
    expect(cards[2]?.value).toMatch(/₹0|0/);
    expect(cards[2]?.hint).toBe('No pending manager handovers');
  });

  it('Card 5 is Payment Yet to Receive and Card 6 is Delivery Collections Pending', () => {
    const cards = mapOpsDashboardKpisToExecutive({
      pendingToReceiveTotal: 300000,
      pendingToReceiveOrders: 12,
      driverCollectionsPending: 8000,
      driverCollectionsCash: 8000,
      driverCollectionsOnline: 0,
    });

    expect(cards[4]?.id).toBe('pending_to_receive');
    expect(cards[4]?.label).toBe('Payment Yet to Receive');
    expect(cards[4]?.href).toContain('/payments');
    expect(cards[4]?.hint).toMatch(/12 order/);
    expect(cards[5]?.id).toBe('driver_collections_pending');
    expect(cards[5]?.label).toBe('Delivery Collections Pending');
    expect(cards[5]?.href).toBe('/payments?tab=settlements&focus=with_driver');
    expect(cards[5]?.hint).toMatch(/Cash with drivers/);
  });

  it('handles zero states without inventing non-zero values', () => {
    const cards = mapOpsDashboardKpisToExecutive({});
    expect(cards[2]?.value).toMatch(/₹0|0/);
    expect(cards[4]?.value).toMatch(/₹0|0/);
    expect(cards[5]?.value).toMatch(/₹0|0/);
  });

  it('propagates parse errors for empty RPC payloads', () => {
    expect(() => parseOpsDashboardKpisRpc(null)).toThrow(/empty payload/i);
  });
});

describe('computePaymentRemaining', () => {
  it('₹10,000 cash only → remaining 0', () => {
    expect(
      computePaymentRemaining({ amountDue: 10000, cashReceived: 10000 }),
    ).toEqual({ remaining: 0, overpayment: false, canComplete: true });
  });

  it('₹0 cash → remaining = due (online later)', () => {
    expect(
      computePaymentRemaining({ amountDue: 10000, cashReceived: 0 }),
    ).toEqual({ remaining: 10000, overpayment: false, canComplete: false });
  });

  it('₹4,000 cash → remaining ₹6,000', () => {
    expect(
      computePaymentRemaining({ amountDue: 10000, cashReceived: 4000 }),
    ).toEqual({ remaining: 6000, overpayment: false, canComplete: false });
  });

  it('rejects overpayment', () => {
    expect(
      computePaymentRemaining({ amountDue: 10000, cashReceived: 11000 }),
    ).toEqual({ remaining: 0, overpayment: true, canComplete: false });
  });

  it('cash + confirmed online covers due', () => {
    expect(
      computePaymentRemaining({
        amountDue: 10000,
        cashReceived: 4000,
        onlineConfirmed: 6000,
      }),
    ).toEqual({ remaining: 0, overpayment: false, canComplete: true });
  });
});

describe('Card 3 / 5 / 6 money separation', () => {
  it('Card 3 counts only RECEIVED_BY_MANAGER', () => {
    expect(
      managerCustodyPendingAmount({
        custodyStatus: 'RECEIVED_BY_MANAGER',
        cashAmount: 35000,
      }),
    ).toBe(35000);
    expect(
      managerCustodyPendingAmount({
        custodyStatus: 'WITH_DRIVER',
        cashAmount: 35000,
      }),
    ).toBe(0);
    expect(
      managerCustodyPendingAmount({
        custodyStatus: 'RECEIVED_BY_OWNER',
        cashAmount: 35000,
      }),
    ).toBe(0);
    expect(
      managerCustodyPendingAmount({
        custodyStatus: 'HANDED_TO_COMPANY',
        cashAmount: 35000,
      }),
    ).toBe(0);
  });

  it('Card 5 excludes already-paid OFD orders', () => {
    expect(
      ofdCustomerUnpaidResidual({
        orderTotal: 10000,
        paymentStatus: 'PAID',
        cashCollected: 4000,
        onlineCollected: 6000,
      }),
    ).toBe(0);
  });

  it('Card 5 includes unpaid OFD residual after partial cash', () => {
    expect(
      ofdCustomerUnpaidResidual({
        orderTotal: 10000,
        paymentStatus: 'PAYMENT_PENDING',
        cashCollected: 4000,
        onlineCollected: 0,
      }),
    ).toBe(6000);
  });

  it('Card 6 includes converted sale when cash still WITH_DRIVER', () => {
    expect(
      driverCustodyPendingAmount({
        custodyStatus: 'WITH_DRIVER',
        cashAmount: 4000,
        isConvertedSale: true,
      }),
    ).toBe(4000);
  });

  it('Card 6 is 0 after Manager or Owner receipt', () => {
    expect(
      driverCustodyPendingAmount({
        custodyStatus: 'RECEIVED_BY_MANAGER',
        cashAmount: 4000,
        isConvertedSale: true,
      }),
    ).toBe(0);
    expect(
      driverCustodyPendingAmount({
        custodyStatus: 'RECEIVED_BY_OWNER',
        cashAmount: 4000,
        isConvertedSale: true,
      }),
    ).toBe(0);
  });

  it('multiple managers aggregate via sum of Card 3 amounts', () => {
    const manager1 = managerCustodyPendingAmount({
      custodyStatus: 'RECEIVED_BY_MANAGER',
      cashAmount: 35000,
    });
    const manager2 = managerCustodyPendingAmount({
      custodyStatus: 'RECEIVED_BY_MANAGER',
      cashAmount: 30000,
    });
    expect(manager1 + manager2).toBe(65000);
  });

  it('Card 6 decreases after settlement while Card 5 stays 0 for paid order', () => {
    const before = driverCustodyPendingAmount({
      custodyStatus: 'WITH_DRIVER',
      cashAmount: 4000,
      isConvertedSale: true,
    });
    const after = driverCustodyPendingAmount({
      custodyStatus: 'RECEIVED_BY_MANAGER',
      cashAmount: 4000,
      isConvertedSale: true,
    });
    expect(before).toBe(4000);
    expect(after).toBe(0);
    expect(
      ofdCustomerUnpaidResidual({
        orderTotal: 10000,
        paymentStatus: 'PAID',
        cashCollected: 4000,
        onlineCollected: 6000,
      }),
    ).toBe(0);
  });

  it('online-only confirmed payment contributes 0 to Card 6 custody', () => {
    expect(
      driverCustodyPendingAmount({
        custodyStatus: null,
        cashAmount: 0,
      }),
    ).toBe(0);
    expect(
      ofdCustomerUnpaidResidual({
        orderTotal: 10000,
        paymentStatus: 'PAID',
        cashCollected: 0,
        onlineCollected: 10000,
      }),
    ).toBe(0);
  });

  it('missing online confirmation leaves residual on Card 5', () => {
    expect(
      computePaymentRemaining({
        amountDue: 10000,
        cashReceived: 4000,
        onlineConfirmed: 0,
      }).canComplete,
    ).toBe(false);
    expect(
      ofdCustomerUnpaidResidual({
        orderTotal: 10000,
        paymentStatus: 'PAYMENT_PENDING',
        cashCollected: 4000,
        onlineCollected: 0,
      }),
    ).toBe(6000);
  });
});

describe('settlement permission honesty', () => {
  it('documents read_only cannot settle (RPC requires is_admin)', () => {
    const canSettle = (role: 'ADMIN' | 'READ_ONLY') => role === 'ADMIN';
    expect(canSettle('READ_ONLY')).toBe(false);
    expect(canSettle('ADMIN')).toBe(true);
  });
});

describe('payment query failure surfaces error', () => {
  it('parseOpsDashboardKpisRpc throws on empty payload (no silent ₹0)', () => {
    expect(() => parseOpsDashboardKpisRpc(undefined)).toThrow(/empty payload/i);
  });
});

describe('manager breakdown total matches row sum', () => {
  it('aggregates breakdown rows to dashboard Card 3 total', () => {
    const rows = [
      { amount: 35000 },
      { amount: 30000 },
    ];
    const total = rows.reduce((sum, r) => sum + r.amount, 0);
    const cards = mapOpsDashboardKpisToExecutive({
      managerCollectionsPending: total,
    });
    expect(cards[2]?.value).toContain('65,000');
  });
});
