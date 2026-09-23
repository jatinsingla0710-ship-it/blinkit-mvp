import { create } from 'zustand';
import type { CartLine, Product } from '@/types';
import { isMockAdapterMode } from '@/config/env';
import { getLiveStock } from '@/services/mock/catalog';
import { computeOrderTotals } from '@/utils/order-totals';

interface CartState {
  storeId: string | null;
  lines: CartLine[];
  stockByProductId: Record<string, number>;
  addItem: (product: Product, qty?: number) => { ok: boolean; message?: string };
  setQty: (productId: string, qty: number) => { ok: boolean; message?: string };
  removeItem: (productId: string) => void;
  clearCart: () => void;
  getQty: (productId: string) => number;
  itemCount: () => number;
  getTotals: (priceMap: Record<string, number>) => ReturnType<typeof computeOrderTotals>;
}

function resolveLineStock(productId: string, productStock?: number): number {
  if (isMockAdapterMode()) {
    const live = getLiveStock(productId);
    return live > 0 ? live : (productStock ?? 0);
  }
  return productStock ?? 0;
}

export const useCartStore = create<CartState>((set, get) => ({
  storeId: null,
  lines: [],
  stockByProductId: {},

  addItem: (product, qty = 1) => {
    const state = get();
    if (state.storeId && state.storeId !== product.storeId) {
      return {
        ok: false,
        message: 'Cart has items from another store. Clear cart first.',
      };
    }

    const existing = state.lines.find((l) => l.productId === product.id);
    const nextQty = (existing?.qty ?? 0) + qty;
    const stock = resolveLineStock(product.id, product.stock);

    if (nextQty > stock) {
      return {
        ok: false,
        message: stock === 0 ? 'Out of stock' : `Only ${stock} left`,
      };
    }

    set({
      storeId: product.storeId,
      stockByProductId: {
        ...state.stockByProductId,
        [product.id]: stock,
      },
      lines: existing
        ? state.lines.map((l) =>
            l.productId === product.id ? { ...l, qty: nextQty } : l
          )
        : [...state.lines, { productId: product.id, qty: nextQty }],
    });
    return { ok: true };
  },

  setQty: (productId, qty) => {
    if (qty <= 0) {
      get().removeItem(productId);
      return { ok: true };
    }
    const remembered = get().stockByProductId[productId];
    const stock = resolveLineStock(productId, remembered);
    if (qty > stock) {
      return { ok: false, message: `Only ${stock} left` };
    }
    set((state) => ({
      lines: state.lines.map((l) =>
        l.productId === productId ? { ...l, qty } : l
      ),
    }));
    return { ok: true };
  },

  removeItem: (productId) => {
    set((state) => {
      const lines = state.lines.filter((l) => l.productId !== productId);
      const { [productId]: _removed, ...stockByProductId } = state.stockByProductId;
      return { lines, stockByProductId, storeId: lines.length ? state.storeId : null };
    });
  },

  clearCart: () => set({ storeId: null, lines: [], stockByProductId: {} }),

  getQty: (productId) =>
    get().lines.find((l) => l.productId === productId)?.qty ?? 0,

  itemCount: () => get().lines.reduce((sum, l) => sum + l.qty, 0),

  getTotals: (priceMap) => {
    const priced = get().lines.map((l) => ({
      price: priceMap[l.productId] ?? 0,
      qty: l.qty,
    }));
    return computeOrderTotals(priced);
  },
}));
