import { roundMoney } from './packaging';

export type DiscountType = 'none' | 'percent' | 'fixed';
export type ContainerPriceMode = 'calculated' | 'custom';

export type SkuDiscountConfig = {
  packDiscountType?: DiscountType | null;
  packDiscountValue?: number | null;
  containerPriceMode?: ContainerPriceMode | null;
  containerCustomPrice?: number | null;
  containerDiscountType?: DiscountType | null;
  containerDiscountValue?: number | null;
};

type NormalizedDiscountConfig = {
  packDiscountType: DiscountType;
  packDiscountValue: number;
  containerPriceMode: ContainerPriceMode;
  containerCustomPrice: number | null;
  containerDiscountType: DiscountType;
  containerDiscountValue: number;
};

export type DiscountPreview = {
  regularPrice: number;
  discountAmount: number;
  finalPrice: number;
  discountLabel: string | null;
};

export type PackContainerPricing = {
  regularPackPrice: number;
  packFinalPrice: number;
  packDiscountAmount: number;
  packDiscountLabel: string | null;
  containerRegularPrice?: number;
  containerFinalPrice?: number;
  containerDiscountAmount?: number;
  containerDiscountLabel?: string | null;
  containerSavingsVsCalculated?: number;
  packsPerOuter?: number;
};

export type LineTotalResult = {
  lineTotal: number;
  effectiveUnitPrice: number;
  fullContainers: number;
  loosePacks: number;
  pricing: PackContainerPricing;
};

export function normalizeDiscountConfig(
  config?: SkuDiscountConfig | null,
): NormalizedDiscountConfig {
  return {
    packDiscountType: config?.packDiscountType ?? 'none',
    packDiscountValue: Number(config?.packDiscountValue ?? 0),
    containerPriceMode: config?.containerPriceMode ?? 'calculated',
    containerCustomPrice:
      config?.containerCustomPrice != null
        ? Number(config.containerCustomPrice)
        : null,
    containerDiscountType: config?.containerDiscountType ?? 'none',
    containerDiscountValue: Number(config?.containerDiscountValue ?? 0),
  };
}

export function validateDiscountInput(
  regularPrice: number,
  discountType: DiscountType,
  discountValue: number,
): string | null {
  if (discountType === 'none') return null;
  if (!Number.isFinite(regularPrice) || regularPrice < 0) {
    return 'Regular price must be non-negative';
  }
  if (!Number.isFinite(discountValue) || discountValue < 0) {
    return 'Discount cannot be negative';
  }
  if (discountType === 'percent' && discountValue > 100) {
    return 'Percentage discount cannot exceed 100%';
  }
  if (discountType === 'fixed' && discountValue > regularPrice) {
    return 'Fixed discount cannot exceed the regular price';
  }
  return null;
}

export function applyDiscount(
  regularPrice: number,
  discountType: DiscountType,
  discountValue: number,
): DiscountPreview | { error: string } {
  const validationError = validateDiscountInput(
    regularPrice,
    discountType,
    discountValue,
  );
  if (validationError) return { error: validationError };

  if (discountType === 'none') {
    return {
      regularPrice: roundMoney(regularPrice),
      discountAmount: 0,
      finalPrice: roundMoney(regularPrice),
      discountLabel: null,
    };
  }

  const discountAmount =
    discountType === 'percent'
      ? roundMoney((regularPrice * discountValue) / 100)
      : roundMoney(discountValue);
  const finalPrice = roundMoney(Math.max(0, regularPrice - discountAmount));

  return {
    regularPrice: roundMoney(regularPrice),
    discountAmount,
    finalPrice,
    discountLabel:
      discountType === 'percent'
        ? `${discountValue}% OFF`
        : `Save ₹${discountAmount}`,
  };
}

export function resolveContainerRegularPrice(input: {
  regularPackPrice: number;
  packsPerOuter?: number | null;
  mode?: ContainerPriceMode | null;
  customPrice?: number | null;
}): number | null {
  const packsPerOuter = input.packsPerOuter;
  if (packsPerOuter == null || packsPerOuter <= 0) return null;

  const mode = input.mode ?? 'calculated';
  if (mode === 'custom') {
    if (
      input.customPrice == null ||
      !Number.isFinite(input.customPrice) ||
      input.customPrice < 0
    ) {
      return null;
    }
    return roundMoney(input.customPrice);
  }

  return roundMoney(input.regularPackPrice * packsPerOuter);
}

export function buildPackContainerPricing(input: {
  regularPackPrice: number;
  packsPerOuter?: number | null;
  config?: SkuDiscountConfig | null;
}): PackContainerPricing | { error: string } {
  const config = normalizeDiscountConfig(input.config);
  const regularPackPrice = roundMoney(input.regularPackPrice);

  const packApplied = applyDiscount(
    regularPackPrice,
    config.packDiscountType,
    config.packDiscountValue,
  );
  if ('error' in packApplied) return packApplied;

  const result: PackContainerPricing = {
    regularPackPrice,
    packFinalPrice: packApplied.finalPrice,
    packDiscountAmount: packApplied.discountAmount,
    packDiscountLabel: packApplied.discountLabel,
  };

  const packsPerOuter = input.packsPerOuter;
  if (packsPerOuter == null || packsPerOuter <= 0) return result;

  const containerRegular = resolveContainerRegularPrice({
    regularPackPrice,
    packsPerOuter,
    mode: config.containerPriceMode,
    customPrice: config.containerCustomPrice,
  });
  if (containerRegular == null) {
    return { error: 'Container regular price is invalid' };
  }

  const containerApplied = applyDiscount(
    containerRegular,
    config.containerDiscountType,
    config.containerDiscountValue,
  );
  if ('error' in containerApplied) return containerApplied;

  const calculatedRegular = roundMoney(regularPackPrice * packsPerOuter);

  result.packsPerOuter = packsPerOuter;
  result.containerRegularPrice = containerRegular;
  result.containerFinalPrice = containerApplied.finalPrice;
  result.containerDiscountAmount = containerApplied.discountAmount;
  result.containerDiscountLabel = containerApplied.discountLabel;
  result.containerSavingsVsCalculated =
    config.containerPriceMode === 'custom'
      ? roundMoney(Math.max(0, calculatedRegular - containerApplied.finalPrice))
      : containerApplied.discountAmount > 0
        ? containerApplied.discountAmount
        : undefined;

  return result;
}

export function lineTotalWithPackagingSplit(input: {
  quantity: number;
  regularPackPrice: number;
  packsPerOuter?: number | null;
  config?: SkuDiscountConfig | null;
}): LineTotalResult | { error: string } {
  const qty = Math.max(0, input.quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return { error: 'Quantity must be positive' };
  }

  const pricing = buildPackContainerPricing({
    regularPackPrice: input.regularPackPrice,
    packsPerOuter: input.packsPerOuter,
    config: input.config,
  });
  if ('error' in pricing) return pricing;

  const ppo = pricing.packsPerOuter;
  let fullContainers = 0;
  let loosePacks = qty;

  if (ppo != null && ppo > 0) {
    fullContainers = Math.floor(qty / ppo);
    loosePacks = qty % ppo;
  }

  const containerPart =
    fullContainers > 0 && pricing.containerFinalPrice != null
      ? roundMoney(fullContainers * pricing.containerFinalPrice)
      : 0;
  const loosePart = roundMoney(loosePacks * pricing.packFinalPrice);
  const lineTotal = roundMoney(containerPart + loosePart);

  return {
    lineTotal,
    effectiveUnitPrice: roundMoney(lineTotal / qty),
    fullContainers,
    loosePacks,
    pricing,
  };
}

export function formatDiscountBadge(
  regularPrice: number,
  finalPrice: number,
  discountLabel?: string | null,
): string | null {
  if (finalPrice >= regularPrice) return null;
  if (discountLabel) return discountLabel;
  const saved = roundMoney(regularPrice - finalPrice);
  return saved > 0 ? `Save ₹${saved}` : null;
}
