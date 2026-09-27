import { describe, expect, it, vi } from 'vitest';
import { retailerFixture as retailer } from '@/test-utils/fixtures';
import {
  confirmPlacedOrder,
  evaluateOrderSubmitGate,
  interpretPlacedOrder,
} from './order-submit';

const ready = {
  shopId: 'shop-1',
  retailers: [retailer()],
  retailersLoading: false,
  retailersError: false,
  catalogueReady: true,
};

describe('evaluateOrderSubmitGate (H)', () => {
  it('blocks submit while retailers are loading even with ?shopId=', () => {
    const gate = evaluateOrderSubmitGate({
      ...ready,
      retailers: undefined,
      retailersLoading: true,
    });
    expect(gate.canSubmit).toBe(false);
  });

  it('blocks submit when retailers failed to load', () => {
    const gate = evaluateOrderSubmitGate({
      ...ready,
      retailers: undefined,
      retailersError: true,
    });
    expect(gate.canSubmit).toBe(false);
  });

  it('blocks submit when shopId is not in the assigned list', () => {
    const gate = evaluateOrderSubmitGate({ ...ready, shopId: 'someone-elses-shop' });
    expect(gate).toMatchObject({ canSubmit: false });
    if (!gate.canSubmit) expect(gate.reason).toMatch(/not in your assigned list/);
  });

  it('blocks submit with an explanation when the shop has no service area', () => {
    const gate = evaluateOrderSubmitGate({
      ...ready,
      retailers: [retailer({ serviceAreaId: null })],
    });
    expect(gate.canSubmit).toBe(false);
    if (!gate.canSubmit) {
      expect(gate.reason).toContain('Sharma Stores has no service area');
    }
  });

  it('blocks submit until the catalogue is ready', () => {
    expect(evaluateOrderSubmitGate({ ...ready, catalogueReady: false }).canSubmit).toBe(
      false,
    );
  });

  it('allows submit only with a loaded shop and its service area', () => {
    const gate = evaluateOrderSubmitGate(ready);
    expect(gate).toMatchObject({ canSubmit: true, serviceAreaId: 'area-1' });
    if (gate.canSubmit) expect(gate.shop.id).toBe('shop-1');
  });
});

describe('placed order outcome (I)', () => {
  it('{ ok: false } is never a success outcome', () => {
    expect(
      interpretPlacedOrder('order-1', { ok: false, message: 'challenge failed' }),
    ).toEqual({ kind: 'confirmation_failed', orderId: 'order-1', message: 'challenge failed' });
  });

  it('{ ok: true } is a success outcome', () => {
    expect(interpretPlacedOrder('order-1', { ok: true, message: 'queued' }).kind).toBe(
      'confirmation_sent',
    );
  });

  it('a thrown confirmation step becomes confirmation_failed, not success', async () => {
    const send = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(confirmPlacedOrder('order-1', send)).resolves.toEqual({
      kind: 'confirmation_failed',
      orderId: 'order-1',
      message: 'network down',
    });
    expect(send).toHaveBeenCalledWith('order-1');
  });

  it('an { ok: false } confirmation step becomes confirmation_failed', async () => {
    const send = vi.fn().mockResolvedValue({ ok: false, message: '' });
    const outcome = await confirmPlacedOrder('order-1', send);
    expect(outcome.kind).toBe('confirmation_failed');
    expect(outcome.message).toBe('Customer confirmation could not be sent.');
  });
});
