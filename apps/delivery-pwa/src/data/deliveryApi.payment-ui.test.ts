import { beforeEach, describe, expect, it } from 'vitest';
import {
  createMockDeliveryService,
  mockReportDigitalPayment,
  resetMockDeliveryApiState,
  seedMockStopAmountDue,
} from './deliveryApi';

describe('Delivery PWA payment collection visibility (mock)', () => {
  beforeEach(() => {
    resetMockDeliveryApiState();
  });

  it('unpaid COD stop exposes remaining amount for collection UI', async () => {
    seedMockStopAmountDue('mock-order-1', 1000);
    const api = createMockDeliveryService();
    const stops = await api.getRouteStops('mock-route-1');
    const stop = stops.find((s) => s.orderId === 'mock-order-1')!;
    expect(stop.paymentStatus).toBe('UNPAID');
    expect(stop.codCollected).toBe(false);
    expect(stop.awaitingVerification).toBe(false);
    expect(stop.amount - stop.cashCollectedAmount).toBe(1000);
  });

  it('Collect Cash updates payment and allows complete', async () => {
    seedMockStopAmountDue('mock-order-1', 1000);
    const api = createMockDeliveryService();
    const paid = await api.recordCashPayment({
      orderId: 'mock-order-1',
      cashAmount: 1000,
    });
    expect(paid.canCompleteDelivery).toBe(true);
    expect(paid.paymentStatus).toBe('PAID');
    await api.completeStop({ stopId: 'mock-stop-1' });
    const stops = await api.getRouteStops('mock-route-1');
    expect(stops.find((s) => s.id === 'mock-stop-1')?.status).toBe('COMPLETED');
  });

  it('Bank/UPI report sets awaiting verification without marking PAID', async () => {
    seedMockStopAmountDue('mock-order-1', 1000);
    const result = mockReportDigitalPayment(
      'mock-order-1',
      1000,
      'UPI_ON_DELIVERY',
      'UPI123',
    );
    expect(result.awaitingVerification).toBe(true);
    expect(result.paymentStatus).toBe('PAYMENT_PENDING');
    expect(result.canCompleteDelivery).toBe(true);
    expect(result.onlineCollected).toBe(0);

    const api = createMockDeliveryService();
    const stops = await api.getRouteStops('mock-route-1');
    const stop = stops.find((s) => s.orderId === 'mock-order-1')!;
    expect(stop.awaitingVerification).toBe(true);
    expect(stop.codCollected).toBe(false);
    expect(stop.providerReference).toBe('UPI123');
  });

  it('reported digital payment allows complete without cash PAID', async () => {
    seedMockStopAmountDue('mock-order-1', 1000);
    const api = createMockDeliveryService();
    await api.reportDigitalPayment({
      orderId: 'mock-order-1',
      amount: 1000,
      collectionMethod: 'OTHER',
      reference: 'UTR9',
    });
    await api.completeStop({ stopId: 'mock-stop-1' });
    const stops = await api.getRouteStops('mock-route-1');
    expect(stops.find((s) => s.id === 'mock-stop-1')?.status).toBe('COMPLETED');
  });

  it('unpaid without collection blocks complete', async () => {
    seedMockStopAmountDue('mock-order-1', 1000);
    const api = createMockDeliveryService();
    await expect(api.completeStop({ stopId: 'mock-stop-1' })).rejects.toThrow(
      /unpaid/i,
    );
  });
});
