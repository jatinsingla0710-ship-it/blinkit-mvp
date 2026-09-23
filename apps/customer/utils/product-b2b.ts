import { SELLING_UNIT_LABELS, type SellingUnit } from '@groaurum/shared-types';
import type { Product, SellingUnitUi, StockStatus } from '@/types';

export function resolveStockStatus(stock: number): StockStatus {
  if (stock <= 0) return 'OUT_OF_STOCK';
  if (stock <= 8) return 'LOW_STOCK';
  return 'IN_STOCK';
}

export function formatAddActionLabel(
  sellingUnit: SellingUnitUi,
  quantityStep: number,
): string {
  if (sellingUnit === 'UNIT') return '+ Add';
  if (sellingUnit === 'KG') {
    return quantityStep === 1 ? '+ Add 1 KG' : `+ Add ${quantityStep} KG`;
  }
  if (sellingUnit === 'GRAM') {
    return `+ Add ${quantityStep} g`;
  }
  const label =
    sellingUnit === 'PCS'
      ? 'Pcs'
      : (SELLING_UNIT_LABELS[sellingUnit as SellingUnit] ?? sellingUnit);
  return quantityStep === 1 ? `+ Add ${label}` : `+ Add ${quantityStep} ${label}`;
}

/**
 * Normalize a requested quantity using the SKU's own MOQ + step.
 * Mirrors `@groaurum/shared-types` normalizeOrderQuantity for UI Product rows.
 */
export function normalizeSkuQuantity(
  product: Pick<Product, 'moq' | 'quantityStep'>,
  requestedQty: number,
): number {
  if (requestedQty <= 0) return 0;
  const moq = product.moq > 0 ? product.moq : 1;
  const step = product.quantityStep > 0 ? product.quantityStep : 1;
  const qty = Math.max(requestedQty, moq);
  const steps = Math.ceil((qty - moq) / step);
  return moq + steps * step;
}

/** Step quantity up/down using SKU configuration only. */
export function stepSkuQuantity(
  product: Pick<Product, 'moq' | 'quantityStep' | 'stock'>,
  currentQty: number,
  direction: 1 | -1,
): number {
  const step = product.quantityStep > 0 ? product.quantityStep : 1;
  const moq = product.moq > 0 ? product.moq : step;

  if (direction < 0) {
    if (currentQty <= 0) return 0;
    const next = currentQty - step;
    return next < moq ? 0 : next;
  }

  if (currentQty <= 0) {
    return Math.min(moq, product.stock);
  }

  const next = normalizeSkuQuantity(product, currentQty + step);
  return Math.min(next, product.stock);
}

export function withB2bDefaults(
  product: Omit<
    Product,
    'moq' | 'quantityStep' | 'sellingUnit' | 'stockStatus' | 'addActionLabel'
  > &
    Partial<
      Pick<
        Product,
        | 'moq'
        | 'quantityStep'
        | 'sellingUnit'
        | 'stockStatus'
        | 'addActionLabel'
        | 'grade'
        | 'specification'
        | 'packsPerCarton'
      >
    >,
): Product {
  const sellingUnit = product.sellingUnit ?? 'KG';
  const quantityStep = product.quantityStep ?? 1;
  const moq = product.moq ?? quantityStep;
  const stockStatus = product.stockStatus ?? resolveStockStatus(product.stock);
  return {
    ...product,
    sellingUnit,
    quantityStep,
    moq,
    stockStatus,
    addActionLabel:
      product.addActionLabel ?? formatAddActionLabel(sellingUnit, quantityStep),
  };
}
