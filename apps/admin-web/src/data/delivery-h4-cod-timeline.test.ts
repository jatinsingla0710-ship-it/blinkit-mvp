import { describe, expect, it } from 'vitest';
import {
  isCodCollectable,
  isOnDeliveryPayment,
  paymentTypeLabelFromPayment,
  summarizeCodFromPayments,
} from '@/data/delivery-cod';
import { buildDeliveryRouteTimeline } from '@/data/delivery-timeline';

describe('delivery-cod helpers', () => {
  it('treats PAY_ON_DELIVERY and on-delivery methods as COD', () => {
    expect(
      isOnDeliveryPayment({ method_intent: 'PAY_ON_DELIVERY', amount: 10 }),
    ).toBe(true);
    expect(
      isOnDeliveryPayment({
        method_intent: 'PAY_ONLINE_NOW',
        collection_method: 'CASH_ON_DELIVERY',
        amount: 10,
      }),
    ).toBe(true);
    expect(
      isOnDeliveryPayment({
        method_intent: 'PAY_ONLINE_NOW',
        collection_method: 'ONLINE_GATEWAY',
      }),
    ).toBe(false);
  });

  it('summarizes expected/collected/pending without inventing amounts', () => {
    expect(
      summarizeCodFromPayments([
        {
          method_intent: 'PAY_ON_DELIVERY',
          status: 'PENDING',
          amount: 100,
        },
        {
          method_intent: 'PAY_ON_DELIVERY',
          status: 'PAID',
          amount: 40,
        },
        {
          method_intent: 'PAY_ONLINE_NOW',
          status: 'PAID',
          amount: 999,
        },
      ]),
    ).toEqual({ expected: 140, collected: 40, pending: 100 });
  });

  it('labels payment types and collectability from payments rows', () => {
    expect(paymentTypeLabelFromPayment(null)).toBe('—');
    expect(
      paymentTypeLabelFromPayment({
        method_intent: 'PAY_ON_DELIVERY',
        status: 'PENDING',
      }),
    ).toBe('COD');
    expect(
      isCodCollectable({
        method_intent: 'PAY_ON_DELIVERY',
        status: 'PENDING',
      }),
    ).toBe(true);
    expect(
      isCodCollectable({
        method_intent: 'PAY_ON_DELIVERY',
        status: 'PAID',
      }),
    ).toBe(false);
  });
});

describe('buildDeliveryRouteTimeline', () => {
  it('does not invent vehicle_loaded or departed_warehouse stages', () => {
    const stages = buildDeliveryRouteTimeline({
      routeStatus: 'running',
      createdAtIso: '2026-07-15T08:00:00.000Z',
      updatedAtIso: '2026-07-15T10:00:00.000Z',
      routeStartedAtIso: '2026-07-15T08:15:00.000Z',
      formatDateTime: (iso) => iso,
      stopEvents: [
        {
          id: 'stop-1',
          label: 'Stop delivered · GA-1',
          atIso: '2026-07-15T09:00:00.000Z',
        },
      ],
    });

    expect(stages.map((s) => s.id)).toEqual([
      'route_created',
      'route_started',
      'stop-1',
      'route_completed',
    ]);
    expect(stages.find((s) => s.id === 'route_started')?.atLabel).toBe(
      '2026-07-15T08:15:00.000Z',
    );
    expect(stages.find((s) => s.id === 'route_completed')?.state).toBe(
      'upcoming',
    );
  });

  it('uses updated_at for completed routes with an honest note', () => {
    const stages = buildDeliveryRouteTimeline({
      routeStatus: 'completed',
      createdAtIso: '2026-07-15T08:00:00.000Z',
      updatedAtIso: '2026-07-15T12:00:00.000Z',
      routeStartedAtIso: null,
      formatDateTime: (iso) => iso,
      stopEvents: [],
    });
    const completed = stages.find((s) => s.id === 'route_completed');
    expect(completed?.state).toBe('done');
    expect(completed?.atLabel).toBe('2026-07-15T12:00:00.000Z');
    expect(completed?.note).toMatch(/updated_at/i);
  });
});
