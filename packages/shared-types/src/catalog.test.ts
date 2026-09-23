import { describe, expect, it } from 'vitest';
import {
  getSkuOrderConstraints,
  normalizeOrderQuantity,
  type Sku,
} from './catalog';
import { deriveAvailableQuantity } from './inventory';

const baseSku: Sku = {
  id: 'sku-1',
  productId: 'product-1',
  skuCode: 'SKU-001',
  name: 'Example SKU',
  productType: 'PACKED',
  sellingUnit: 'CARTON',
  packsPerCarton: 12,
  moq: 2,
  quantityStep: 1,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('SKU configuration helpers', () => {
  it('derives available inventory from on-hand and reserved', () => {
    expect(deriveAvailableQuantity(100, 25)).toBe(75);
    expect(deriveAvailableQuantity(10, 15)).toBe(0);
  });

  it('exposes order constraints from SKU configuration', () => {
    expect(getSkuOrderConstraints(baseSku)).toEqual({
      moq: 2,
      quantityStep: 1,
      sellingUnit: 'CARTON',
      productType: 'PACKED',
      packsPerCarton: 12,
      netQuantity: undefined,
      netQuantityUnit: undefined,
    });
  });

  it('normalizes quantity to MOQ and step without product-specific branching', () => {
    expect(normalizeOrderQuantity(baseSku, 1)).toBe(2);
    expect(normalizeOrderQuantity(baseSku, 5)).toBe(5);
  });
});
