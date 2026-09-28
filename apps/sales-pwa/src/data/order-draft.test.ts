import { describe, expect, it, vi } from 'vitest';
import {
  clearOrderDraft,
  draftStorageKey,
  loadOrderDraft,
  saveOrderDraft,
  setDraftLine,
  type DraftStorage,
} from './order-draft';

function memoryStorage(): DraftStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('local order drafts (M)', () => {
  it('saves and restores shop, lines and notes per salesman', () => {
    const storage = memoryStorage();
    const now = new Date('2026-09-27T10:00:00.000Z');
    expect(
      saveOrderDraft(
        'profile-1',
        { shopId: 'shop-1', lines: [{ skuId: 'sku-1', quantity: 50 }], notes: 'Deliver AM' },
        storage,
        now,
      ),
    ).toBe(true);

    expect(loadOrderDraft('profile-1', storage)).toEqual({
      version: 1,
      shopId: 'shop-1',
      lines: [{ skuId: 'sku-1', quantity: 50 }],
      notes: 'Deliver AM',
      updatedAt: now.toISOString(),
    });
    expect(loadOrderDraft('profile-2', storage)).toBeNull();
  });

  it('removes an empty draft instead of storing it', () => {
    const storage = memoryStorage();
    saveOrderDraft('p', { shopId: 's', lines: [{ skuId: 'a', quantity: 1 }], notes: '' }, storage);
    saveOrderDraft('p', { shopId: '', lines: [], notes: '' }, storage);
    expect(storage.data.has(draftStorageKey('p'))).toBe(false);
  });

  it('ignores corrupt or foreign data and invalid lines', () => {
    const storage = memoryStorage();
    storage.setItem(draftStorageKey('p'), '{not json');
    expect(loadOrderDraft('p', storage)).toBeNull();
    storage.setItem(draftStorageKey('p'), JSON.stringify({ version: 2, shopId: 's' }));
    expect(loadOrderDraft('p', storage)).toBeNull();
    storage.setItem(
      draftStorageKey('p'),
      JSON.stringify({
        version: 1,
        shopId: 's',
        lines: [{ skuId: 'a', quantity: 5 }, { skuId: 'b', quantity: -1 }, { quantity: 3 }],
      }),
    );
    expect(loadOrderDraft('p', storage)?.lines).toEqual([{ skuId: 'a', quantity: 5 }]);
  });

  it('survives storage failures without throwing', () => {
    const broken: DraftStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadOrderDraft('p', broken)).toBeNull();
    expect(saveOrderDraft('p', { shopId: 's', lines: [], notes: 'x' }, broken)).toBe(false);
    expect(() => clearOrderDraft('p', broken)).not.toThrow();
  });

  it('keeps one line per SKU and removes on quantity 0', () => {
    let lines = setDraftLine([], 'a', 5);
    lines = setDraftLine(lines, 'b', 10);
    lines = setDraftLine(lines, 'a', 15);
    expect(lines).toEqual([
      { skuId: 'a', quantity: 15 },
      { skuId: 'b', quantity: 10 },
    ]);
    expect(setDraftLine(lines, 'a', 0)).toEqual([{ skuId: 'b', quantity: 10 }]);
  });
});

describe('a draft is not an order (N)', () => {
  it('draft helpers only touch local storage, never the network', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const storage = memoryStorage();
      saveOrderDraft('p', { shopId: 's', lines: [{ skuId: 'a', quantity: 5 }], notes: '' }, storage);
      loadOrderDraft('p', storage);
      clearOrderDraft('p', storage);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
