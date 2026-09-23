import { roundMoney } from './packaging';

export type OuterDiscountTier = {
  minOuterQuantity: number;
  discountPerOuterUnit: number;
};

export type OuterQuantityLineResult = {
  outerUnitCount: number;
  loosePacks: number;
  subtotal: number;
  discountPerOuterUnit: number;
  quantityDiscountTotal: number;
  lineTotal: number;
  tierMinOuterQuantity: number | null;
};

/** Highest tier where minOuterQuantity <= outerUnitCount. */
export function resolveOuterDiscountPerUnit(
  outerUnitCount: number,
  tiers: readonly OuterDiscountTier[],
): { discountPerOuterUnit: number; tierMinOuterQuantity: number | null } {
  const count = Math.max(0, Math.floor(outerUnitCount));
  const eligible = tiers
    .filter((t) => t.minOuterQuantity > 0 && t.minOuterQuantity <= count)
    .sort((a, b) => b.minOuterQuantity - a.minOuterQuantity);

  if (eligible.length === 0) {
    return { discountPerOuterUnit: 0, tierMinOuterQuantity: null };
  }
  return {
    discountPerOuterUnit: eligible[0].discountPerOuterUnit,
    tierMinOuterQuantity: eligible[0].minOuterQuantity,
  };
}

export function validateOuterDiscountTiers(
  tiers: readonly OuterDiscountTier[],
): string | null {
  const seen = new Set<number>();
  const sorted = [...tiers].sort(
    (a, b) => a.minOuterQuantity - b.minOuterQuantity,
  );

  for (const tier of sorted) {
    if (!Number.isFinite(tier.minOuterQuantity) || tier.minOuterQuantity <= 0) {
      return 'Tier quantity must be greater than zero';
    }
    if (!Number.isFinite(tier.discountPerOuterUnit) || tier.discountPerOuterUnit < 0) {
      return 'Discount cannot be negative';
    }
    if (seen.has(tier.minOuterQuantity)) {
      return 'Duplicate tier quantities are not allowed';
    }
    seen.add(tier.minOuterQuantity);
  }

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (curr.discountPerOuterUnit < prev.discountPerOuterUnit) {
      return `Buy ${curr.minOuterQuantity}+ has a lower discount (₹${curr.discountPerOuterUnit}) than buy ${prev.minOuterQuantity}+ (₹${prev.discountPerOuterUnit}) — customers may get a worse deal at higher quantity`;
    }
  }

  return null;
}

/**
 * Order qty is in selling packs. Full outers get quantity-tier discount per outer unit.
 */
export function lineTotalWithOuterQuantityDiscount(input: {
  quantityPacks: number;
  packRegularPrice: number;
  containerRegularPrice?: number | null;
  packsPerOuter?: number | null;
  tiers?: readonly OuterDiscountTier[];
}): OuterQuantityLineResult | { error: string } {
  const qty = Math.max(0, input.quantityPacks);
  if (!Number.isFinite(qty) || qty <= 0) {
    return { error: 'Quantity must be positive' };
  }

  const packPrice = roundMoney(input.packRegularPrice);
  const ppo = input.packsPerOuter;

  if (ppo == null || ppo <= 0) {
    const lineTotal = roundMoney(qty * packPrice);
    return {
      outerUnitCount: 0,
      loosePacks: qty,
      subtotal: lineTotal,
      discountPerOuterUnit: 0,
      quantityDiscountTotal: 0,
      lineTotal,
      tierMinOuterQuantity: null,
    };
  }

  const containerPrice = roundMoney(
    input.containerRegularPrice ?? packPrice * ppo,
  );
  const outerUnitCount = Math.floor(qty / ppo);
  const loosePacks = qty - outerUnitCount * ppo;
  const subtotal = roundMoney(
    outerUnitCount * containerPrice + loosePacks * packPrice,
  );

  const { discountPerOuterUnit, tierMinOuterQuantity } =
    resolveOuterDiscountPerUnit(outerUnitCount, input.tiers ?? []);

  const quantityDiscountTotal = roundMoney(
    outerUnitCount * discountPerOuterUnit,
  );

  if (quantityDiscountTotal > subtotal) {
    return { error: 'Quantity discount exceeds line subtotal' };
  }

  return {
    outerUnitCount,
    loosePacks,
    subtotal,
    discountPerOuterUnit,
    quantityDiscountTotal,
    lineTotal: roundMoney(subtotal - quantityDiscountTotal),
    tierMinOuterQuantity,
  };
}
