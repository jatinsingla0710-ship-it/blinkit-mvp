import { describe, expect, it } from 'vitest';
import {
  formStateFromProductDetail,
  inferMoqDisplay,
} from './product-form-state';
import type { ProductDetail, ProductSkuRow } from './product-types';

function baseProduct(skus: ProductSkuRow[]): ProductDetail {
  return {
    id: 'p1',
    name: 'Atta',
    description: 'Whole wheat flour',
    categoryId: 'c1',
    categoryName: 'Grains',
    productType: 'PACKED',
    isActive: true,
    publishStatus: 'published',
    inventoryStatus: 'in_stock',
    skuCount: skus.length,
    currentTradePriceLabel: '₹166.00',
    updatedAtLabel: '',
    createdAtLabel: '',
    hasImage: true,
    skus,
    priceHistory: [],
    inventoryMovements: [],
    images: [],
    priceTiers: [],
    outerDiscountTiers: [],
    checklist: [],
    canPublish: true,
    warehouseStock: [],
  };
}

const attaSku: ProductSkuRow = {
  id: 's1',
  skuCode: 'ATTA-5KG',
  name: 'Atta 5kg',
  sellingUnit: 'pack',
  netQuantity: 5,
  netQuantityUnit: 'kg',
  moq: 1,
  quantityStep: 1,
  packsPerCarton: 10,
  outerType: 'bag',
  currentTradePrice: 166,
  currentTradePriceLabel: '₹166.00',
  inventoryStatus: 'in_stock',
  availableLabel: '55 packs',
  isActive: true,
};

describe('inferMoqDisplay', () => {
  it('shows container MOQ when divisible by packs per outer', () => {
    expect(
      inferMoqDisplay({
        moqPacks: 10,
        packsPerOuter: 10,
        outerType: 'bag',
      }),
    ).toEqual({ moq: '1', moqUnit: 'bag' });
  });

  it('shows pack MOQ when not aligned to outer count', () => {
    expect(
      inferMoqDisplay({
        moqPacks: 2,
        packsPerOuter: 10,
        outerType: 'bag',
      }),
    ).toEqual({ moq: '2', moqUnit: 'packs' });
  });
});

describe('formStateFromProductDetail', () => {
  it('hydrates Atta pack, bag, and price from primary SKU', () => {
    const form = formStateFromProductDetail(baseProduct([attaSku]), attaSku);
    expect(form.packQuantity).toBe('5');
    expect(form.packUnit).toBe('kg');
    expect(form.outerPackQty).toBe('10');
    expect(form.outerType).toBe('bag');
    expect(form.skuCode).toBe('ATTA-5KG');
    expect(form.basisPrice).not.toBe('');
  });

  it('hydrates oil bottle + carton MOQ', () => {
    const oilSku: ProductSkuRow = {
      ...attaSku,
      skuCode: 'OIL-1L',
      name: 'Oil 1 litre',
      netQuantity: 1,
      netQuantityUnit: 'litre',
      packsPerCarton: 12,
      outerType: 'carton',
      moq: 12,
      currentTradePrice: 120,
    };
    const form = formStateFromProductDetail(baseProduct([oilSku]), oilSku);
    expect(form.packUnit).toBe('litre');
    expect(form.outerType).toBe('carton');
    expect(form.moq).toBe('1');
    expect(form.moqUnit).toBe('carton');
  });
});
