import type { SkuPrice, SkuPriceTier } from '@groaurum/shared-types';

type PriceRow = {
  id: string;
  sku_id: string;
  trade_price: number | string;
  currency: string;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
};

type TierRow = {
  id: string;
  sku_id: string;
  min_quantity: number | string;
  unit_price: number | string;
  currency: string;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
};

/**
 * Select the current effective SKU price at `at` (ISO timestamp).
 * - effective_from <= at
 * - effective_to is null OR effective_to > at
 * - among matches, prefer latest effective_from, then latest created_at
 */
export function selectEffectiveSkuPrice(
  rows: PriceRow[],
  at: Date = new Date(),
): SkuPrice | null {
  const atMs = at.getTime();
  const eligible = rows.filter((row) => {
    const from = new Date(row.effective_from).getTime();
    if (Number.isNaN(from) || from > atMs) {
      return false;
    }
    if (row.effective_to == null) {
      return true;
    }
    const to = new Date(row.effective_to).getTime();
    return !Number.isNaN(to) && to > atMs;
  });

  if (eligible.length === 0) {
    return null;
  }

  eligible.sort((a, b) => {
    const fromDiff =
      new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime();
    if (fromDiff !== 0) return fromDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const best = eligible[0];
  return {
    id: best.id,
    skuId: best.sku_id,
    tradePrice: Number(best.trade_price),
    currency: best.currency,
    effectiveFrom: best.effective_from,
    effectiveTo: best.effective_to ?? undefined,
    createdAt: best.created_at,
  };
}

export function selectOpenPriceTiers(
  rows: TierRow[],
  at: Date = new Date(),
): SkuPriceTier[] {
  const atMs = at.getTime();
  return rows
    .filter((row) => {
      const from = new Date(row.effective_from).getTime();
      if (Number.isNaN(from) || from > atMs) return false;
      if (row.effective_to == null) return true;
      const to = new Date(row.effective_to).getTime();
      return !Number.isNaN(to) && to > atMs;
    })
    .map((row) => ({
      id: row.id,
      skuId: row.sku_id,
      minQuantity: Number(row.min_quantity),
      unitPrice: Number(row.unit_price),
      currency: row.currency,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to ?? undefined,
      createdAt: row.created_at,
    }))
    .sort((a, b) => a.minQuantity - b.minQuantity);
}

/**
 * Client-side mirror of resolve_effective_sku_trade_price(sku, qty).
 * Server is authoritative at order time.
 */
export function resolveEffectiveUnitPrice(
  basePrice: number,
  quantity: number,
  tiers: readonly Pick<SkuPriceTier, 'minQuantity' | 'unitPrice'>[],
): number {
  const qty = Math.max(1, quantity);
  const eligible = tiers
    .filter((t) => t.minQuantity > 1 && t.minQuantity <= qty)
    .sort((a, b) => b.minQuantity - a.minQuantity);
  if (eligible.length > 0) {
    return eligible[0].unitPrice;
  }
  return basePrice;
}
