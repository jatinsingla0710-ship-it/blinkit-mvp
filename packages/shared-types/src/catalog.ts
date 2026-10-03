import { SELLING_UNIT_LABELS, type ProductType, type SellingUnit } from './enums';

export interface Category {
  id: string;
  name: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  productType: ProductType;
  imageUrls: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * SKU carries all configuration needed for ordering UI and services
 * without scattering product-type or selling-unit conditionals across the app.
 */
export interface Sku {
  id: string;
  productId: string;
  skuCode: string;
  name: string;
  specification?: string;
  grade?: string;
  productType: ProductType;
  /** Standard SELLING_UNITS value or a custom free-text unit name. */
  sellingUnit: SellingUnit | string;
  /** Net quantity when applicable (e.g. per pack or per unit). */
  netQuantity?: number;
  netQuantityUnit?: string;
  /** Required when sellingUnit is CARTON for PACKED products. */
  packsPerCarton?: number;
  /** Master/outer packaging type (box, carton, bag, …). */
  outerType?: string;
  /** Pack-level discount configuration. */
  packDiscountType?: 'none' | 'percent' | 'fixed';
  packDiscountValue?: number;
  /** Container price: calculated from packs or custom wholesale price. */
  containerPriceMode?: 'calculated' | 'custom';
  containerCustomPrice?: number | null;
  containerDiscountType?: 'none' | 'percent' | 'fixed';
  containerDiscountValue?: number;
  /** HSN for GST rate mapping. */
  hsnCode?: string | null;
  /** GST rate percent. */
  gstRatePercent?: number | null;
  moq: number;
  quantityStep: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SkuPrice {
  id: string;
  skuId: string;
  tradePrice: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string;
  createdAt: string;
}

/** Append-only price history row — never mutate prior commercial records. */
export interface SkuPriceHistoryEntry extends SkuPrice {
  recordedByProfileId?: string;
}

/** Quantity-based discount per outer unit (Bag/Box/Carton). */
export interface SkuOuterDiscountTier {
  id: string;
  skuId: string;
  minOuterQuantity: number;
  discountPerOuterUnit: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string;
  createdAt: string;
}

/** @deprecated Legacy pack-quantity absolute unit price tiers — prefer SkuOuterDiscountTier. */
export interface SkuPriceTier {
  id: string;
  skuId: string;
  minQuantity: number;
  unitPrice: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string;
  createdAt: string;
}

export interface SkuOrderConstraints {
  moq: number;
  quantityStep: number;
  sellingUnit: SellingUnit | string;
  productType: ProductType;
  packsPerCarton?: number;
  netQuantity?: number;
  netQuantityUnit?: string;
}

/** Derive ordering constraints from SKU configuration. */
export function getSkuOrderConstraints(sku: Sku): SkuOrderConstraints {
  return {
    moq: sku.moq,
    quantityStep: sku.quantityStep,
    sellingUnit: sku.sellingUnit,
    productType: sku.productType,
    packsPerCarton: sku.packsPerCarton,
    netQuantity: sku.netQuantity,
    netQuantityUnit: sku.netQuantityUnit,
  };
}

/** Normalize quantity to the nearest valid step at or above MOQ. */
export function normalizeOrderQuantity(sku: Sku, requestedQty: number): number {
  const { moq, quantityStep } = getSkuOrderConstraints(sku);
  const qty = Math.max(requestedQty, moq);
  const steps = Math.ceil((qty - moq) / quantityStep);
  return moq + steps * quantityStep;
}

export function formatSellingUnitLabel(sku: Pick<Sku, 'sellingUnit' | 'netQuantity' | 'netQuantityUnit' | 'packsPerCarton'>): string {
  if (sku.sellingUnit === 'CARTON' && sku.packsPerCarton) {
    return `Carton (${sku.packsPerCarton} packs)`;
  }
  if (sku.netQuantity && sku.netQuantityUnit) {
    return `${sku.netQuantity} ${sku.netQuantityUnit}`;
  }
  const key = String(sku.sellingUnit).toUpperCase() as SellingUnit;
  return SELLING_UNIT_LABELS[key] ?? String(sku.sellingUnit);
}
