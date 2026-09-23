/**
 * Restock suggestions from prior order history + live catalogue SKUs.
 * Quantity suggestions are normalized with each SKU's moq / quantityStep —
 * no hard-coded multipliers or unit-specific business rules.
 */
import type { Order, Product, RestockSuggestion } from '@/types';
import { isMockAdapterMode } from '@/config/env';
import { fetchCustomerProducts } from '@/services/customer-catalogue';
import { fetchCustomerOrders } from '@/services/customer-orders';
import { normalizeSkuQuantity } from '@/utils/product-b2b';

export type RestockPlan = {
  suggestions: RestockSuggestion[];
  skuCount: number;
  totalSuggestedUnits: number;
  estimatedValue: number;
  hasHistory: boolean;
};

function aggregateLastOrderedQty(orders: Order[], storeId: string): Map<string, number> {
  const lastQty = new Map<string, number>();
  // Orders are newest-first from getOrders().
  for (const order of orders) {
    if (order.storeId !== storeId) continue;
    for (const line of order.lines) {
      if (!lastQty.has(line.productId)) {
        lastQty.set(line.productId, line.qty);
      }
    }
  }
  return lastQty;
}

/**
 * Mock-only: seed a prior delivered order so Restock can be demoed without
 * forcing the retailer through checkout first. Supabase mode never invents history.
 */
async function ensureMockOrderHistory(
  storeId: string,
  products: Product[],
): Promise<Order[]> {
  const { getOrders, seedMockDeliveredOrder } = await import(
    '@/services/mock/orders'
  );
  const existing = await getOrders();
  if (existing.some((o) => o.storeId === storeId && o.lines.length > 0)) {
    return existing;
  }

  const candidates = products
    .filter((p) => p.storeId === storeId && p.stock > 0)
    .slice(0, 5);
  if (!candidates.length) return existing;

  seedMockDeliveredOrder(
    storeId,
    candidates.map((p) => ({
      product: p,
      // Use each SKU's own MOQ as the historical qty — no invented multipliers.
      qty: normalizeSkuQuantity(p, p.moq),
    })),
  );

  return getOrders();
}

export async function fetchRestockPlan(storeOrShopId: string): Promise<RestockPlan> {
  const products = await fetchCustomerProducts(storeOrShopId);
  let orders: Order[] = [];

  if (isMockAdapterMode()) {
    orders = await ensureMockOrderHistory(storeOrShopId, products);
  } else {
    orders = await fetchCustomerOrders(storeOrShopId);
  }

  const lastQty = aggregateLastOrderedQty(orders, storeOrShopId);
  const hasHistory = lastQty.size > 0;

  if (!hasHistory) {
    return {
      suggestions: [],
      skuCount: 0,
      totalSuggestedUnits: 0,
      estimatedValue: 0,
      hasHistory: false,
    };
  }

  const productById = new Map(products.map((p) => [p.id, p]));
  const suggestions: RestockSuggestion[] = [];

  for (const [productId, lastOrderedQty] of lastQty) {
    const product = productById.get(productId);
    if (!product) continue;
    if (product.stockStatus === 'OUT_OF_STOCK' || product.stock <= 0) continue;

    const suggestedQty = Math.min(
      normalizeSkuQuantity(product, lastOrderedQty),
      product.stock,
    );
    if (suggestedQty <= 0) continue;

    suggestions.push({
      product,
      lastOrderedQty,
      suggestedQty,
    });
  }

  const estimatedValue = suggestions.reduce(
    (sum, row) => sum + row.product.price * row.suggestedQty,
    0,
  );
  const totalSuggestedUnits = suggestions.reduce(
    (sum, row) => sum + row.suggestedQty,
    0,
  );

  return {
    suggestions,
    skuCount: suggestions.length,
    totalSuggestedUnits,
    estimatedValue,
    hasHistory: true,
  };
}

export function estimateRestockValue(
  suggestions: RestockSuggestion[],
  qtyByProductId: Record<string, number>,
): number {
  return suggestions.reduce((sum, row) => {
    const qty = qtyByProductId[row.product.id] ?? 0;
    return sum + row.product.price * qty;
  }, 0);
}

export function countRestockUnits(qtyByProductId: Record<string, number>): number {
  return Object.values(qtyByProductId).reduce((sum, qty) => sum + qty, 0);
}

export function countRestockSkus(qtyByProductId: Record<string, number>): number {
  return Object.values(qtyByProductId).filter((qty) => qty > 0).length;
}
