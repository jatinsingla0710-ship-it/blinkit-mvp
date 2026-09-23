import { formatInr, roundMoney } from './packaging';

export type PriceTier = {
  minQuantity: number;
  unitPrice: number;
};

export type PricingBreakdown = {
  baseUnitPrice: number;
  baseUnitLabel: string;
  outerUnitPrice?: number;
  outerUnitLabel?: string;
  piecesPerOuter?: number;
};

export type TierDisplayRow = {
  minQuantity: number;
  quantityLabel: string;
  unitPrice: number;
  unitPriceLabel: string;
  savings?: number;
  savingsLabel?: string;
};

/**
 * Select best applicable tier for a quantity (highest min_quantity <= qty).
 * Falls back to basePrice when no tier matches.
 */
export function resolveUnitPriceForQuantity(
  quantity: number,
  basePrice: number,
  tiers: readonly PriceTier[],
): { unitPrice: number; tierMinQuantity: number | null } {
  const qty = Math.max(1, quantity);
  const eligible = tiers
    .filter((t) => t.minQuantity > 1 && t.minQuantity <= qty)
    .sort((a, b) => b.minQuantity - a.minQuantity);

  if (eligible.length > 0) {
    return {
      unitPrice: eligible[0].unitPrice,
      tierMinQuantity: eligible[0].minQuantity,
    };
  }
  return { unitPrice: basePrice, tierMinQuantity: null };
}

export function lineTotalForQuantity(
  quantity: number,
  basePrice: number,
  tiers: readonly PriceTier[],
): { unitPrice: number; lineTotal: number; tierApplied: boolean } {
  const { unitPrice, tierMinQuantity } = resolveUnitPriceForQuantity(
    quantity,
    basePrice,
    tiers,
  );
  return {
    unitPrice,
    lineTotal: roundMoney(unitPrice * quantity),
    tierApplied: tierMinQuantity != null,
  };
}

export function buildPricingBreakdown(input: {
  baseUnitPrice: number;
  baseUnitLabel: string;
  packsPerOuter?: number | null;
  outerUnitLabel?: string;
}): PricingBreakdown {
  const result: PricingBreakdown = {
    baseUnitPrice: input.baseUnitPrice,
    baseUnitLabel: input.baseUnitLabel,
  };
  const per = input.packsPerOuter;
  if (per != null && per > 0) {
    result.piecesPerOuter = per;
    result.outerUnitLabel = input.outerUnitLabel ?? 'Bag';
    result.outerUnitPrice = roundMoney(input.baseUnitPrice * per);
  }
  return result;
}

export function buildTierDisplayRows(input: {
  baseUnitPrice: number;
  baseUnitLabel: string;
  tiers: readonly PriceTier[];
  unitWord?: string;
}): TierDisplayRow[] {
  const unitWord = input.unitWord ?? 'each';
  const rows: TierDisplayRow[] = [
    {
      minQuantity: 1,
      quantityLabel: `1 ${input.baseUnitLabel}`,
      unitPrice: input.baseUnitPrice,
      unitPriceLabel: `${formatInr(input.baseUnitPrice)} ${unitWord}`,
    },
  ];

  const sorted = [...input.tiers]
    .filter((t) => t.minQuantity > 1)
    .sort((a, b) => a.minQuantity - b.minQuantity);

  for (const tier of sorted) {
    const savings = roundMoney(
      (input.baseUnitPrice - tier.unitPrice) * tier.minQuantity,
    );
    rows.push({
      minQuantity: tier.minQuantity,
      quantityLabel: `${tier.minQuantity} ${input.baseUnitLabel}${tier.minQuantity > 1 ? 's' : ''}`,
      unitPrice: tier.unitPrice,
      unitPriceLabel: `${formatInr(tier.unitPrice)} ${unitWord}`,
      savings: savings > 0 ? savings : undefined,
      savingsLabel:
        savings > 0 ? formatInr(savings) : undefined,
    });
  }

  return rows;
}

export function formatSavingsMessage(
  quantity: number,
  basePrice: number,
  tiers: readonly PriceTier[],
): string | null {
  const { unitPrice, tierMinQuantity } = resolveUnitPriceForQuantity(
    quantity,
    basePrice,
    tiers,
  );
  if (tierMinQuantity == null || unitPrice >= basePrice) return null;
  const saved = roundMoney((basePrice - unitPrice) * quantity);
  if (saved <= 0) return null;
  return `Quantity discount applied — ${formatInr(unitPrice)} per unit (save ${formatInr(saved)})`;
}
