import { describe, expect, it, vi } from 'vitest';
import type { SalesmanOrderPreview } from '@groaurum/api-client';
import { submitReviewedOrder, type SubmitOrderApi } from './order-submit';

const LINES = [{ skuId: 'sku-1', quantity: 50 }];

function preview(total: number, ok = true): SalesmanOrderPreview {
  return {
    lines: [
      {
        skuId: 'sku-1',
        quantity: 50,
        unitPrice: total / 50,
        lineTotal: total,
        availableQuantity: 500,
        ok,
        errorCode: ok ? null : 'INSUFFICIENT_STOCK',
        message: ok ? null : 'Only 4 available',
      },
    ],
    itemCount: 1,
    subtotal: total,
    total,
    currency: 'INR',
    allValid: ok,
    pricedAt: '2026-09-27T10:00:00.000Z',
  };
}

function fakeApi(overrides: Partial<SubmitOrderApi> = {}) {
  return {
    previewOrderLines: vi.fn(async () => preview(8275)),
    placeAssistedOrder: vi.fn(async () => 'order-1'),
    sendConfirmationPlaceholder: vi.fn(async () => ({ ok: true, message: 'queued' })),
    ...overrides,
  } satisfies SubmitOrderApi;
}

function run(api: SubmitOrderApi, reviewed = preview(8275)) {
  return submitReviewedOrder({
    api,
    shopId: 'shop-1',
    serviceAreaId: 'area-1',
    lines: LINES,
    reviewed,
    notes: '  Deliver AM  ',
    timeouts: { previewMs: 50, placeMs: 50 },
  });
}

describe('submitReviewedOrder (P, J)', () => {
  it('places exactly the reviewed lines once and sends one approval request', async () => {
    const api = fakeApi();
    const result = await run(api);
    expect(result).toEqual({
      kind: 'placed',
      outcome: { kind: 'confirmation_sent', orderId: 'order-1', message: 'queued' },
    });
    expect(api.placeAssistedOrder).toHaveBeenCalledTimes(1);
    expect(api.placeAssistedOrder).toHaveBeenCalledWith({
      shopId: 'shop-1',
      serviceAreaId: 'area-1',
      lines: [{ skuId: 'sku-1', quantity: 50, agreedUnitPrice: 165.5 }],
      notes: 'Deliver AM',
    });
    expect(api.sendConfirmationPlaceholder).toHaveBeenCalledWith('order-1');
  });

  it('stops without placing when the server price changed since review', async () => {
    const api = fakeApi({ previewOrderLines: vi.fn(async () => preview(8300)) });
    const result = await run(api);
    expect(result.kind).toBe('prices_changed');
    if (result.kind === 'prices_changed') expect(result.fresh.total).toBe(8300);
    expect(api.placeAssistedOrder).not.toHaveBeenCalled();
  });

  it('stops without placing when stock ran out since review', async () => {
    const api = fakeApi({ previewOrderLines: vi.fn(async () => preview(8275, false)) });
    expect((await run(api)).kind).toBe('prices_changed');
    expect(api.placeAssistedOrder).not.toHaveBeenCalled();
  });

  it('a failed price re-check submits nothing and is safe to retry', async () => {
    const api = fakeApi({
      previewOrderLines: vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    });
    const result = await run(api);
    expect(result).toMatchObject({ kind: 'failed', failure: { kind: 'rejected' } });
    expect(api.placeAssistedOrder).not.toHaveBeenCalled();
  });
});

describe('confirmation failure (Q)', () => {
  it('reports the created order and never places a second one', async () => {
    const api = fakeApi({
      sendConfirmationPlaceholder: vi.fn(async () => {
        throw new Error('provider down');
      }),
    });
    const result = await run(api);
    expect(result).toEqual({
      kind: 'placed',
      outcome: { kind: 'confirmation_failed', orderId: 'order-1', message: 'provider down' },
    });
    expect(api.placeAssistedOrder).toHaveBeenCalledTimes(1);
  });
});

describe('weak network on submit (T)', () => {
  it('a place timeout is uncertain and is not retried automatically', async () => {
    const api = fakeApi({ placeAssistedOrder: vi.fn(() => new Promise<string>(() => undefined)) });
    const result = await run(api);
    expect(result).toMatchObject({ kind: 'failed', failure: { kind: 'uncertain' } });
    expect(api.placeAssistedOrder).toHaveBeenCalledTimes(1);
    expect(api.sendConfirmationPlaceholder).not.toHaveBeenCalled();
  });

  it('a dropped connection during place is uncertain', async () => {
    const api = fakeApi({
      placeAssistedOrder: vi.fn(async () => {
        throw { message: 'TypeError: Failed to fetch', code: '' };
      }),
    });
    expect(await run(api)).toMatchObject({ kind: 'failed', failure: { kind: 'uncertain' } });
  });

  it('a server rejection is explained and marked safe to fix', async () => {
    const api = fakeApi({
      placeAssistedOrder: vi.fn(async () => {
        throw { message: 'Insufficient stock for RICE-1 (available 4)', code: 'P0001' };
      }),
    });
    expect(await run(api)).toEqual({
      kind: 'failed',
      failure: {
        kind: 'rejected',
        message: 'Not enough stock for one of the items. Edit the items and try again.',
      },
    });
  });
});
