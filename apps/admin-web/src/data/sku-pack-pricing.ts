/**
 * SKU pack / price / box calculations for Admin ERP.
 *
 * Maps to existing columns:
 * - Pack size  → skus.net_quantity + skus.net_quantity_unit
 * - Packs/outer → skus.packs_per_carton
 * - Trade price → sku_prices.trade_price = commercial price per selling pack
 *
 * Price basis is an Admin input convenience; pack trade price is stored.
 * Unit compatibility lives in pack-units.ts (single source of truth).
 */

import {
  convertSameFamily,
  defaultPriceBasisForPackUnit as defaultBasisFromConfig,
  isPriceBasisCompatible,
  priceBasisLabel as packUnitPriceBasisLabel,
  resolvePackUnit,
  roundMoney,
  toFamilyBase,
  type PriceBasis,
} from './pack-units';

export type { PriceBasis } from './pack-units';
export {
  defaultPriceBasisForPackUnit,
  isPriceBasisCompatible,
  priceBasesForPackUnit,
  priceBasisLabel,
} from './pack-units';

/** @deprecated Prefer resolvePackUnit(...).category / family from pack-units. */
export type PackUnitKind = 'mass' | 'piece' | 'volume' | 'packaging' | 'other';

export function normalizeUnit(unit: string | null | undefined): string {
  return (unit ?? '').trim().toLowerCase();
}

export function classifyPackUnit(unit: string | null | undefined): PackUnitKind {
  const def = resolvePackUnit(unit);
  if (!def) return 'other';
  if (def.category === 'weight') return 'mass';
  if (def.category === 'count') return 'piece';
  if (def.category === 'volume') return 'volume';
  if (def.category === 'packaging') return 'packaging';
  return 'other';
}

/** Convert mass quantity to kilograms. Returns null when unit is not mass. */
export function toKilograms(
  quantity: number,
  unit: string | null | undefined,
): number | null {
  const base = toFamilyBase(quantity, unit);
  if (!base || base.family !== 'weight') return null;
  return base.baseAmount / 1000;
}

/** Convert mass quantity to grams. */
export function toGrams(
  quantity: number,
  unit: string | null | undefined,
): number | null {
  const base = toFamilyBase(quantity, unit);
  if (!base || base.family !== 'weight') return null;
  return base.baseAmount;
}

function pricePerBaseUnit(
  basisPrice: number,
  priceBasis: PriceBasis,
): { family: 'weight' | 'volume'; perBase: number } | { perUnit: number } | { error: string } {
  switch (priceBasis) {
    case 'per_mg':
      return { family: 'weight', perBase: basisPrice / 0.001 }; // price per g equiv via mg
    case 'per_g':
      return { family: 'weight', perBase: basisPrice };
    case 'per_kg':
      return { family: 'weight', perBase: basisPrice / 1000 };
    case 'per_tonne':
      return { family: 'weight', perBase: basisPrice / 1_000_000 };
    case 'per_ml':
      return { family: 'volume', perBase: basisPrice };
    case 'per_litre':
      return { family: 'volume', perBase: basisPrice / 1000 };
    case 'per_piece':
    case 'per_pair':
    case 'per_dozen':
    case 'per_bag':
    case 'per_bottle':
    case 'per_box':
    case 'per_packet':
    case 'per_pouch':
    case 'per_jar':
    case 'per_can':
    case 'per_carton':
    case 'per_drum':
    case 'per_pack':
      return { perUnit: basisPrice };
    default:
      return { error: 'Unsupported price basis' };
  }
}

/**
 * Convert an Admin-entered basis price into the commercial pack trade price.
 * Example: ₹800/kg × 250 g pack → ₹200 / pack
 */
export function packTradePriceFromBasis(input: {
  basisPrice: number;
  priceBasis: PriceBasis;
  packQuantity: number;
  packUnit: string | null | undefined;
}): { packTradePrice: number } | { error: string } {
  const { basisPrice, priceBasis, packQuantity, packUnit } = input;
  if (!Number.isFinite(basisPrice) || basisPrice <= 0) {
    return { error: 'Price must be greater than zero' };
  }
  if (!Number.isFinite(packQuantity) || packQuantity <= 0) {
    return { error: 'Pack quantity must be greater than zero' };
  }
  if (!isPriceBasisCompatible(packUnit, priceBasis)) {
    return {
      error: `Price basis "${packUnitPriceBasisLabel(priceBasis)}" is not valid for pack unit "${packUnit ?? ''}"`,
    };
  }

  if (priceBasis === 'per_pack') {
    return { packTradePrice: roundMoney(basisPrice) };
  }

  const priced = pricePerBaseUnit(basisPrice, priceBasis);
  if ('error' in priced) return priced;

  if ('family' in priced) {
    const base = toFamilyBase(packQuantity, packUnit);
    if (!base || base.family !== priced.family) {
      return {
        error: `Price basis requires a ${priced.family} pack unit`,
      };
    }
    // Integer-friendly: (basis * packBase) with family-scaled perBase
    // per_kg stores perBase = basis/1000 (₹ per gram); packBase in grams.
    return { packTradePrice: roundMoney(priced.perBase * base.baseAmount) };
  }

  // Unit-count / packaging bases: multiply by pack quantity
  // (e.g. 12 pcs × ₹50/piece, or 1 bottle × ₹40/bottle)
  return { packTradePrice: roundMoney(priced.perUnit * packQuantity) };
}

/**
 * Reverse: from stored pack trade price, derive a reference basis price.
 */
export function basisPriceFromPackTrade(input: {
  packTradePrice: number;
  priceBasis: PriceBasis;
  packQuantity: number;
  packUnit: string | null | undefined;
}): { basisPrice: number } | { error: string } {
  const { packTradePrice, priceBasis, packQuantity, packUnit } = input;
  if (!Number.isFinite(packTradePrice) || packTradePrice < 0) {
    return { error: 'Pack trade price must be non-negative' };
  }
  if (!Number.isFinite(packQuantity) || packQuantity <= 0) {
    return { error: 'Pack quantity must be greater than zero' };
  }

  if (priceBasis === 'per_pack') {
    return { basisPrice: packTradePrice };
  }

  if (
    priceBasis === 'per_kg' ||
    priceBasis === 'per_g' ||
    priceBasis === 'per_mg' ||
    priceBasis === 'per_tonne'
  ) {
    const base = toFamilyBase(packQuantity, packUnit);
    if (!base || base.family !== 'weight' || base.baseAmount <= 0) {
      return { error: 'Price basis Per kg / Per g requires a mass pack unit' };
    }
    const perGram = packTradePrice / base.baseAmount;
    if (priceBasis === 'per_g') return { basisPrice: perGram };
    if (priceBasis === 'per_mg') return { basisPrice: perGram * 0.001 };
    if (priceBasis === 'per_kg') return { basisPrice: perGram * 1000 };
    return { basisPrice: perGram * 1_000_000 };
  }

  if (priceBasis === 'per_ml' || priceBasis === 'per_litre') {
    const base = toFamilyBase(packQuantity, packUnit);
    if (!base || base.family !== 'volume' || base.baseAmount <= 0) {
      return { error: 'Price basis Per ml / Per litre requires a volume pack unit' };
    }
    const perMl = packTradePrice / base.baseAmount;
    return {
      basisPrice: priceBasis === 'per_ml' ? perMl : perMl * 1000,
    };
  }

  return { basisPrice: packTradePrice / packQuantity };
}

/**
 * Legacy: how many selling packs fit when box is expressed as total mass/pieces.
 * Prefer packsPerOuterFromCount for the Create Product wizard.
 */
export function packsPerBoxFromQuantities(input: {
  packQuantity: number;
  packUnit: string | null | undefined;
  boxQuantity: number;
  boxUnit: string | null | undefined;
}): { packsPerBox: number } | { error: string } {
  const { packQuantity, packUnit, boxQuantity, boxUnit } = input;
  if (!Number.isFinite(packQuantity) || packQuantity <= 0) {
    return { error: 'Pack quantity must be greater than zero' };
  }
  if (!Number.isFinite(boxQuantity) || boxQuantity <= 0) {
    return { error: 'Box quantity must be greater than zero' };
  }

  const packKind = classifyPackUnit(packUnit);
  const boxKind = classifyPackUnit(boxUnit);

  if (packKind === 'mass' && boxKind === 'mass') {
    const packKg = toKilograms(packQuantity, packUnit);
    const boxKg = toKilograms(boxQuantity, boxUnit);
    if (packKg == null || boxKg == null || packKg <= 0) {
      return { error: 'Could not convert pack/box sizes to kilograms' };
    }
    const packs = boxKg / packKg;
    if (!Number.isFinite(packs) || packs <= 0) {
      return { error: 'Invalid packs-per-box result' };
    }
    const rounded = Math.round(packs);
    if (Math.abs(packs - rounded) > 1e-6) {
      return {
        error: `Box does not divide evenly into packs (${packs.toFixed(3)} packs)`,
      };
    }
    return { packsPerBox: rounded };
  }

  if (packKind === 'piece' && boxKind === 'piece') {
    const packs = boxQuantity / packQuantity;
    const rounded = Math.round(packs);
    if (Math.abs(packs - rounded) > 1e-6 || rounded <= 0) {
      return {
        error: `Box does not divide evenly into packs (${packs.toFixed(3)} packs)`,
      };
    }
    return { packsPerBox: rounded };
  }

  if (packKind === 'volume' && boxKind === 'volume') {
    const converted = convertSameFamily(boxQuantity, boxUnit, packUnit);
    if (converted == null || packQuantity <= 0) {
      return { error: 'Could not convert pack/box sizes to the same volume unit' };
    }
    const packs = converted / packQuantity;
    const rounded = Math.round(packs);
    if (Math.abs(packs - rounded) > 1e-6 || rounded <= 0) {
      return {
        error: `Box does not divide evenly into packs (${packs.toFixed(3)} packs)`,
      };
    }
    return { packsPerBox: rounded };
  }

  return {
    error: 'Pack unit and box unit must be compatible (same family)',
  };
}

/** New Create Product model: outer packaging = N selling packs per outer. */
export function packsPerOuterFromCount(
  packsPerOuter: number,
): { packsPerBox: number } | { error: string } {
  if (!Number.isFinite(packsPerOuter) || packsPerOuter <= 0) {
    return { error: 'Quantity per outer package must be greater than zero' };
  }
  const rounded = Math.round(packsPerOuter);
  if (Math.abs(packsPerOuter - rounded) > 1e-6) {
    return { error: 'Quantity per outer package must be a whole number' };
  }
  return { packsPerBox: rounded };
}

export function boxValueFromPacks(input: {
  packTradePrice: number;
  packsPerBox: number;
}): { boxValue: number } | { error: string } {
  const { packTradePrice, packsPerBox } = input;
  if (!Number.isFinite(packTradePrice) || packTradePrice < 0) {
    return { error: 'Pack trade price must be non-negative' };
  }
  if (!Number.isFinite(packsPerBox) || packsPerBox <= 0) {
    return { error: 'Packs per box must be greater than zero' };
  }
  return { boxValue: roundMoney(packTradePrice * packsPerBox) };
}

/** Reverse display: box qty from packs × pack size (mass or pieces). */
export function boxQuantityFromPacks(input: {
  packsPerBox: number;
  packQuantity: number;
  packUnit: string | null | undefined;
  preferredBoxUnit?: 'kg' | 'g' | 'litre' | 'ml';
}): { boxQuantity: number; boxUnit: string } | null {
  const { packsPerBox, packQuantity, packUnit } = input;
  if (!Number.isFinite(packsPerBox) || packsPerBox <= 0) return null;
  if (!Number.isFinite(packQuantity) || packQuantity <= 0) return null;

  const kind = classifyPackUnit(packUnit);
  if (kind === 'piece' || kind === 'packaging') {
    return {
      boxQuantity: packsPerBox * packQuantity,
      boxUnit: normalizeUnit(packUnit) || 'pcs',
    };
  }

  if (kind === 'mass') {
    const packKg = toKilograms(packQuantity, packUnit);
    if (packKg == null) return null;
    const boxKg = packsPerBox * packKg;
    const preferred = input.preferredBoxUnit ?? (boxKg >= 1 ? 'kg' : 'g');
    if (preferred === 'g') {
      return { boxQuantity: boxKg * 1000, boxUnit: 'g' };
    }
    return { boxQuantity: boxKg, boxUnit: 'kg' };
  }

  if (kind === 'volume') {
    const base = toFamilyBase(packQuantity, packUnit);
    if (!base) return null;
    const totalMl = packsPerBox * base.baseAmount;
    if (totalMl >= 1000) {
      return { boxQuantity: totalMl / 1000, boxUnit: 'litre' };
    }
    return { boxQuantity: totalMl, boxUnit: 'ml' };
  }

  return null;
}

export type SkuCommercialBreakdown = {
  packLabel: string;
  packTradePrice: number;
  packTradePriceLabel: string;
  referenceBasis: PriceBasis;
  referencePrice: number;
  referenceLabel: string;
  packsPerBox?: number;
  boxLabel?: string;
  boxValue?: number;
  boxValueLabel?: string;
};

function formatInr(amount: number): string {
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
  }).format(amount);
  return `₹${formatted}`;
}

/**
 * Full Admin display breakdown from stored pack fields + pack trade price.
 */
export function buildSkuCommercialBreakdown(input: {
  packQuantity?: number | null;
  packUnit?: string | null;
  packTradePrice?: number | null;
  packsPerBox?: number | null;
}): SkuCommercialBreakdown | null {
  const packQuantity = Number(input.packQuantity);
  const packTradePrice = Number(input.packTradePrice);
  if (!Number.isFinite(packQuantity) || packQuantity <= 0) return null;
  if (!Number.isFinite(packTradePrice) || packTradePrice < 0) return null;

  const packUnit = (input.packUnit ?? '').trim() || 'unit';
  const packLabel = `${packQuantity} ${packUnit}`;
  const referenceBasis = defaultBasisFromConfig(packUnit);
  const basis = basisPriceFromPackTrade({
    packTradePrice,
    priceBasis: referenceBasis,
    packQuantity,
    packUnit,
  });
  if ('error' in basis) return null;

  const result: SkuCommercialBreakdown = {
    packLabel,
    packTradePrice,
    packTradePriceLabel: `${formatInr(packTradePrice)} / pack`,
    referenceBasis,
    referencePrice: basis.basisPrice,
    referenceLabel: `${formatInr(basis.basisPrice)} · ${packUnitPriceBasisLabel(referenceBasis)}`,
  };

  const packsPerBox = Number(input.packsPerBox);
  if (Number.isFinite(packsPerBox) && packsPerBox > 0) {
    result.packsPerBox = packsPerBox;
    const boxQty = boxQuantityFromPacks({
      packsPerBox,
      packQuantity,
      packUnit,
    });
    if (boxQty) {
      result.boxLabel = `${boxQty.boxQuantity} ${boxQty.boxUnit}`;
    }
    const value = boxValueFromPacks({ packTradePrice, packsPerBox });
    if (!('error' in value)) {
      result.boxValue = value.boxValue;
      result.boxValueLabel = `${formatInr(value.boxValue)} / outer`;
    }
  }

  return result;
}
