import {
  buildSkuCommercialBreakdown,
  defaultPriceBasisForPackUnit,
  packTradePriceFromBasis,
  type PriceBasis,
} from './sku-pack-pricing';
import { formatInrPrecise } from './live/format';

export type UnitPriceBreakdown = {
  packQuantity: number;
  packUnitLabel: string;
  /** Commercial pack trade price (stored). */
  packTradePrice: number;
  packTradePriceLabel: string;
  /** Reference basis price (derived, e.g. ₹/kg). */
  unitPrice: number;
  unitPriceLabel: string;
  calculationLabel: string;
  priceBasis: PriceBasis;
};

/**
 * Display helpers for stored pack trade price + pack size.
 * tradePrice = commercial price per selling pack (not the basis price).
 */
export function deriveUnitPrice(input: {
  tradePrice: number;
  netQuantity?: number | null;
  netQuantityUnit?: string | null;
}): UnitPriceBreakdown | null {
  const breakdown = buildSkuCommercialBreakdown({
    packQuantity: input.netQuantity,
    packUnit: input.netQuantityUnit,
    packTradePrice: input.tradePrice,
  });
  if (!breakdown) return null;

  const packQuantity = Number(input.netQuantity);
  const packUnitLabel = (input.netQuantityUnit ?? '').trim() || 'unit';

  return {
    packQuantity,
    packUnitLabel,
    packTradePrice: breakdown.packTradePrice,
    packTradePriceLabel: breakdown.packTradePriceLabel,
    unitPrice: breakdown.referencePrice,
    unitPriceLabel: breakdown.referenceLabel,
    calculationLabel: `${breakdown.packTradePriceLabel} · ${breakdown.referenceLabel}`,
    priceBasis: breakdown.referenceBasis,
  };
}

/**
 * Preview: Admin enters basis price → show pack commercial price before save.
 */
export function previewPackPriceFromBasisInput(input: {
  basisPrice: number;
  priceBasis: PriceBasis;
  netQuantity?: number | null;
  netQuantityUnit?: string | null;
}): {
  packTradePrice: number;
  packTradePriceLabel: string;
  calculationLabel: string;
} | null {
  const packQuantity = Number(input.netQuantity);
  if (!Number.isFinite(packQuantity) || packQuantity <= 0) return null;

  const result = packTradePriceFromBasis({
    basisPrice: input.basisPrice,
    priceBasis: input.priceBasis,
    packQuantity,
    packUnit: input.netQuantityUnit,
  });
  if ('error' in result) return null;

  const packLabel = `${packQuantity} ${(input.netQuantityUnit ?? '').trim() || 'unit'}`;
  return {
    packTradePrice: result.packTradePrice,
    packTradePriceLabel: `${formatInrPrecise(result.packTradePrice)} / ${packLabel} pack`,
    calculationLabel: `${formatInrPrecise(input.basisPrice)} (${input.priceBasis.replace('per_', '/').replace('_', ' ')}) → ${formatInrPrecise(result.packTradePrice)} / pack`,
  };
}

export { defaultPriceBasisForPackUnit };
export type { PriceBasis };
