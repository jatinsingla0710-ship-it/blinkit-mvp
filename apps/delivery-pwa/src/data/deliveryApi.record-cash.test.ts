import { beforeEach, describe, expect, it } from 'vitest';
import {
  createMockDeliveryService,
  resetMockDeliveryApiState,
  seedMockStopAmountDue,
} from './deliveryApi';

describe('Delivery PWA mock recordCashPayment', () => {
  beforeEach(() => {
    resetMockDeliveryApiState();
  });

  it('exposes recordCashPayment on mock adapter', () => {
    const api = createMockDeliveryService();
    expect(typeof api.recordCashPayment).toBe('function');
  });

  it('₹10,000 order + ₹4,000 cash → remaining ₹6,000 (DEMO)', async () => {
    seedMockStopAmountDue('mock-order-1', 10000);
    const api = createMockDeliveryService();
    const result = await api.recordCashPayment({
      orderId: 'mock-order-1',
      cashAmount: 4000,
    });
    expect(result.cashCollected).toBe(4000);
    expect(result.remaining).toBe(6000);
    expect(result.paymentStatus).toBe('PAYMENT_PENDING');
    expect(result.canCompleteDelivery).toBe(false);
    expect(result.onlineCollected).toBe(0);
  });

  it('₹10,000 + ₹10,000 cash → remaining ₹0', async () => {
    seedMockStopAmountDue('mock-order-1', 10000);
    const api = createMockDeliveryService();
    const result = await api.recordCashPayment({
      orderId: 'mock-order-1',
      cashAmount: 10000,
    });
    expect(result.remaining).toBe(0);
    expect(result.canCompleteDelivery).toBe(true);
    expect(result.paymentStatus).toBe('PAID');
  });

  it('rejects overpayment', async () => {
    seedMockStopAmountDue('mock-order-1', 10000);
    const api = createMockDeliveryService();
    await expect(
      api.recordCashPayment({ orderId: 'mock-order-1', cashAmount: 11000 }),
    ).rejects.toThrow(/exceed/i);
  });

  it('partial cash does not falsely mark order fully paid', async () => {
    seedMockStopAmountDue('mock-order-1', 10000);
    const api = createMockDeliveryService();
    await api.recordCashPayment({
      orderId: 'mock-order-1',
      cashAmount: 4000,
    });
    const stops = await api.getRouteStops('mock-route-1');
    const stop = stops.find((s) => s.orderId === 'mock-order-1');
    expect(stop?.paymentStatus).toBe('PAYMENT_PENDING');
    expect(stop?.codCollected).toBe(false);
    await expect(
      api.completeStop({ stopId: 'mock-stop-1' }),
    ).rejects.toThrow(/unpaid/i);
  });
});
