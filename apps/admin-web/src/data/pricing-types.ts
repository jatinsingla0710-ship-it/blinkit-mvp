/**
 * Pricing Management — current trade price + append-only history.
 * Unit price is derived from SKU pack quantity; never stored separately.
 */

import type { PriceBasis } from './pack-units';

export type PriceRecordStatus = 'live' | 'expired' | 'unpriced';

export interface SkuPriceListRow {
  id: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  productId: string;
  productName: string;
  currentPriceLabel: string;
  /** Numeric trade price for order/create flows when live. */
  currentTradePrice?: number;
  /** Derived unit price label when pack quantity is available. */
  unitPriceLabel?: string;
  /** Catalogue selling unit for counter-sale / order UX. */
  sellingUnitLabel?: string;
  moq?: number;
  quantityStep?: number;
  /** Sum of available inventory across locations when known. */
  availableQuantity?: number;
  status: PriceRecordStatus;
  updatedAtLabel: string;
}

export interface PriceRecordRow {
  id: string;
  tradePriceLabel: string;
  tradePrice?: number;
  effectiveFromLabel: string;
  effectiveToLabel?: string;
  status: PriceRecordStatus;
  createdAtLabel: string;
  createdByLabel: string;
}

export interface SetPriceDraft {
  /** Admin-entered price on the selected basis (converted to pack trade on save). */
  basisPrice: string;
  priceBasis: PriceBasis;
}

export interface SkuPricingDetail {
  skuId: string;
  skuCode: string;
  skuName: string;
  productId: string;
  productName: string;
  sellingUnitLabel: string;
  /** SKU pack size for derived unit price (skus.net_quantity). */
  netQuantity?: number;
  /** SKU pack unit (skus.net_quantity_unit). */
  netQuantityUnit?: string;
  current: PriceRecordRow | null;
  history: PriceRecordRow[];
  listStatus: PriceRecordStatus;
  updatedAtLabel: string;
}
