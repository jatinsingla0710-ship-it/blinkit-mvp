import { beforeEach, describe, expect, it } from 'vitest';
import {
  createMockDeliveryService,
  resetMockDeliveryApiState,
  seedMockStopAmountDue,
} from './deliveryApi';

describe('Delivery PWA complete-delivery payment gate (mock)', () => {
  beforeEach(() => {
    resetMockDeliveryApiState();
  });

  it('COD: full cash → WITH_DRIVER path (codCollected) → complete succeeds', async () => {
    seedMockStopAmountDue('mock-order-1', 1000);
    const api = createMockDeliveryService();
    const paid = await api.recordCashPayment({
      orderId: 'mock-order-1',
      cashAmount: 1000,
    });
    expect(paid.remaining).toBe(0);
    expect(paid.canCompleteDelivery).toBe(true);
    expect(paid.paymentStatus).toBe('PAID');

    await api.completeStop({ stopId: 'mock-stop-1' });
    const stops = await api.getRouteStops('mock-route-1');
    expect(stops.find((s) => s.id === 'mock-stop-1')?.status).toBe('COMPLETED');
  });

  it('already-paid stop can complete without collecting again', async () => {
    seedMockStopAmountDue('mock-order-1', 1000);
    const api = createMockDeliveryService();
    await api.recordCashPayment({ orderId: 'mock-order-1', cashAmount: 1000 });
    await api.completeStop({ stopId: 'mock-stop-1' });
    // Double click — mock does not throw once completed; re-run status stays COMPLETED.
    const stops = await api.getRouteStops('mock-route-1');
    expect(stops.find((s) => s.id === 'mock-stop-1')?.status).toBe('COMPLETED');
  });

  it('payment required but not collected → complete blocked', async () => {
    seedMockStopAmountDue('mock-order-1', 1000);
    const api = createMockDeliveryService();
    await expect(api.completeStop({ stopId: 'mock-stop-1' })).rejects.toThrow(
      /unpaid/i,
    );
  });

  it('partial cash does not allow complete', async () => {
    seedMockStopAmountDue('mock-order-1', 1000);
    const api = createMockDeliveryService();
    const partial = await api.recordCashPayment({
      orderId: 'mock-order-1',
      cashAmount: 400,
    });
    expect(partial.canCompleteDelivery).toBe(false);
    await expect(api.completeStop({ stopId: 'mock-stop-1' })).rejects.toThrow(
      /unpaid/i,
    );
  });
});
