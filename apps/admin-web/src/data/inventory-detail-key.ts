/**
 * Inventory detail is scoped by skuId + optional balanceId (inventory_balances.id).
 * Encodes into a single repository getById key so React Query cannot mix warehouses.
 */

const SEPARATOR = '::';

export function inventoryDetailLookupKey(
  skuId: string,
  balanceId?: string | null,
): string {
  const sku = skuId.trim();
  const balance = (balanceId ?? '').trim();
  return balance ? `${sku}${SEPARATOR}${balance}` : sku;
}

export function parseInventoryDetailLookupKey(id: string): {
  skuId: string;
  balanceId?: string;
} {
  const raw = id.trim();
  const idx = raw.indexOf(SEPARATOR);
  if (idx < 0) return { skuId: raw };
  const skuId = raw.slice(0, idx);
  const balanceId = raw.slice(idx + SEPARATOR.length);
  return balanceId ? { skuId, balanceId } : { skuId };
}

export function inventoryDetailPath(
  skuId: string,
  balanceId?: string | null,
): string {
  const base = `/inventory/${encodeURIComponent(skuId)}`;
  const balance = (balanceId ?? '').trim();
  if (!balance) return base;
  return `${base}?balance=${encodeURIComponent(balance)}`;
}

/**
 * Choose which balance to display for a SKU.
 * Prefer explicit balanceId when it belongs to this SKU; else first active warehouse;
 * else first balance (historical inactive still viewable).
 */
export function selectInventoryBalance<
  T extends { balanceId: string; warehouseActive: boolean },
>(warehouses: readonly T[], requestedBalanceId?: string | null): T | null {
  if (warehouses.length === 0) return null;
  const requested = (requestedBalanceId ?? '').trim();
  if (requested) {
    const match = warehouses.find((w) => w.balanceId === requested);
    if (match) return match;
  }
  return warehouses.find((w) => w.warehouseActive) ?? warehouses[0] ?? null;
}
