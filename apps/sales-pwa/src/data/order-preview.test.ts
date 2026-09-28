import { describe, expect, it } from 'vitest';
import type { SalesmanOrderPreview } from '@groaurum/api-client';
import { cartKey, diffPreviews, hasPreviewChanges, previewMatchesCart } from './order-preview';
import { cartSummaryStatus } from '@/pages/create-order/CartSummaryBar';

function preview(
  lines: { skuId: string; quantity: number; lineTotal: number; unitPrice?: number; ok?: boolean }[],
): SalesmanOrderPreview {
  const total = lines.reduce((s, l) => s + l.lineTotal, 0);
  return {
    lines: lines.map((l) => ({
      skuId: l.skuId,
      quantity: l.quantity,
      unitPrice: l.unitPrice ?? l.lineTotal / l.quantity,
      lineTotal: l.lineTotal,
      availableQuantity: 500,
      ok: l.ok ?? true,
      errorCode: l.ok === false ? 'INSUFFICIENT_STOCK' : null,
      message: l.ok === false ? 'Only 4 available' : null,
    })),
    itemCount: lines.length,
    subtotal: total,
    total,
    currency: 'INR',
    allValid: lines.every((l) => l.ok !== false),
    pricedAt: '2026-09-27T10:00:00.000Z',
  };
}

const state = (current: SalesmanOrderPreview | undefined, extra: Partial<{ isError: boolean; error: unknown }> = {}) => ({
  current,
  pending: !current,
  error: extra.error ?? null,
  isError: extra.isError ?? false,
  retrying: false,
  retry: () => undefined,
});

describe('server preview is the only total (J)', () => {
  it('uses the server total exactly (bag discount included), not qty × pack price', () => {
    const p = preview([{ skuId: 'a', quantity: 50, lineTotal: 8275, unitPrice: 165.5 }]);
    const lines = [{ skuId: 'a', quantity: 50 }];
    expect(previewMatchesCart(p, lines)).toBe(true);
    expect(cartSummaryStatus({ itemCount: 1, online: true, preview: state(p) })).toEqual({
      kind: 'ready',
      total: 8275,
    });
  });

  it('treats a preview for a different cart as no total at all', () => {
    const p = preview([{ skuId: 'a', quantity: 50, lineTotal: 8275 }]);
    expect(previewMatchesCart(p, [{ skuId: 'a', quantity: 55 }])).toBe(false);
    expect(previewMatchesCart(p, [{ skuId: 'a', quantity: 50 }, { skuId: 'b', quantity: 1 }])).toBe(false);
    expect(previewMatchesCart(undefined, [])).toBe(false);
  });

  it('flags any price, total or validity change between review and submit', () => {
    const reviewed = preview([{ skuId: 'a', quantity: 50, lineTotal: 8275 }]);
    expect(hasPreviewChanges(diffPreviews(reviewed, reviewed))).toBe(false);
    const repriced = preview([{ skuId: 'a', quantity: 50, lineTotal: 8300 }]);
    const diff = diffPreviews(reviewed, repriced);
    expect(diff.totalChanged).toBe(true);
    expect(diff.lines).toEqual([{ skuId: 'a', before: 8275, after: 8300 }]);
    const noStock = preview([{ skuId: 'a', quantity: 50, lineTotal: 8275, ok: false }]);
    expect(diffPreviews(reviewed, noStock).validityChanged).toBe(true);
  });
});

describe('cart running total states (L, S, T)', () => {
  it('keys the cart by SKU and quantity in order', () => {
    expect(cartKey([{ skuId: 'a', quantity: 5 }, { skuId: 'b', quantity: 10 }])).toBe('a:5|b:10');
    expect(cartKey([])).toBe('');
  });

  it('shows empty, pending, offline, error and invalid states — never ₹0 for a failure', () => {
    expect(cartSummaryStatus({ itemCount: 0, online: true, preview: state(undefined) }).kind).toBe('empty');
    expect(cartSummaryStatus({ itemCount: 2, online: true, preview: state(undefined) }).kind).toBe('pending');
    expect(cartSummaryStatus({ itemCount: 2, online: false, preview: state(undefined) }).kind).toBe('offline');
    const failed = cartSummaryStatus({
      itemCount: 2,
      online: true,
      preview: state(undefined, { isError: true, error: new Error('timeout') }),
    });
    expect(failed).toEqual({ kind: 'error', message: 'timeout' });
    const invalid = preview([{ skuId: 'a', quantity: 50, lineTotal: 8275, ok: false }]);
    expect(cartSummaryStatus({ itemCount: 1, online: true, preview: state(invalid) }).kind).toBe('invalid');
  });
});
