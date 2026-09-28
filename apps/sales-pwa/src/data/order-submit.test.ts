import { describe, expect, it, vi } from 'vitest';
import { retailerFixture as retailer } from '@/test-utils/fixtures';
import {
  SubmitTimeoutError,
  classifySubmitError,
  confirmPlacedOrder,
  createSubmitLock,
  evaluateOrderSubmitGate,
  friendlyOrderError,
  interpretPlacedOrder,
  withSubmitTimeout,
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

  it('Q: a failed confirmation never calls place again (one order only)', async () => {
    const place = vi.fn().mockResolvedValue('order-1');
    const send = vi.fn().mockRejectedValue(new Error('provider down'));
    const orderId = await place();
    const outcome = await confirmPlacedOrder(orderId, send);
    expect(outcome.kind).toBe('confirmation_failed');
    expect(outcome.orderId).toBe('order-1');
    expect(place).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('double-submit lock (O)', () => {
  it('rejects a second acquire while the first submit is in flight', () => {
    const lock = createSubmitLock();
    expect(lock.tryAcquire()).toBe(true);
    expect(lock.tryAcquire()).toBe(false);
    expect(lock.held).toBe(true);
    lock.release();
    expect(lock.tryAcquire()).toBe(true);
  });

  it('two rapid taps start only one place call', async () => {
    const lock = createSubmitLock();
    const place = vi.fn(
      () => new Promise<string>((resolve) => setTimeout(() => resolve('order-1'), 5)),
    );
    async function tap() {
      if (!lock.tryAcquire()) return null;
      return place();
    }
    const [first, second] = await Promise.all([tap(), tap()]);
    expect(first).toBe('order-1');
    expect(second).toBeNull();
    expect(place).toHaveBeenCalledTimes(1);
  });
});

describe('submit timeouts and uncertain outcomes (T)', () => {
  it('times out a hanging request as SubmitTimeoutError', async () => {
    vi.useFakeTimers();
    try {
      const pending = withSubmitTimeout(new Promise<string>(() => undefined), 1000);
      const assertion = expect(pending).rejects.toBeInstanceOf(SubmitTimeoutError);
      await vi.advanceTimersByTimeAsync(1000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('passes through a result that arrives in time', async () => {
    await expect(withSubmitTimeout(Promise.resolve('ok'), 1000)).resolves.toBe('ok');
  });

  it('treats timeouts and network failures as uncertain (never auto-retry)', () => {
    expect(classifySubmitError(new SubmitTimeoutError()).kind).toBe('uncertain');
    expect(classifySubmitError(new TypeError('Failed to fetch')).kind).toBe('uncertain');
    expect(classifySubmitError({ message: 'TypeError: Load failed' }).kind).toBe('uncertain');
    expect(classifySubmitError({ message: 'Bad gateway', status: 502 }).kind).toBe('uncertain');
    expect(classifySubmitError({ name: 'AbortError', message: '' }).kind).toBe('uncertain');
  });

  it('treats server business errors as rejected (nothing was created)', () => {
    expect(
      classifySubmitError({ message: 'Insufficient stock for RICE-1 (available 4)', code: 'P0001' }),
    ).toEqual({ kind: 'rejected', message: 'Insufficient stock for RICE-1 (available 4)' });
    expect(classifySubmitError({ message: 'Shop is not assigned to this salesman' }).kind).toBe(
      'rejected',
    );
  });

  it('explains common rejections in plain language', () => {
    expect(friendlyOrderError('Insufficient stock for RICE-1 (available 4)')).toMatch(
      /Not enough stock/,
    );
    expect(
      friendlyOrderError(
        'new row for relation "order_lines" violates check constraint "order_lines_line_total_matches"',
      ),
    ).toMatch(/cannot be priced per pack exactly/);
    expect(friendlyOrderError('Something else')).toBe('Something else');
  });
});
