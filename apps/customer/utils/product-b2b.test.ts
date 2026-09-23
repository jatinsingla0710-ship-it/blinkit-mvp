import { describe, expect, it } from 'vitest';
import { normalizeSkuQuantity, stepSkuQuantity } from './product-b2b';

describe('SKU quantity helpers (Restock)', () => {
  it('normalizes using MOQ and step from the SKU, not hard-coded units', () => {
    expect(
      normalizeSkuQuantity({ moq: 10, quantityStep: 10 }, 12),
    ).toBe(20);
    expect(normalizeSkuQuantity({ moq: 1, quantityStep: 1 }, 3)).toBe(3);
  });

  it('steps carton and KG SKUs from their own configuration', () => {
    const carton = { moq: 1, quantityStep: 1, stock: 50 };
    expect(stepSkuQuantity(carton, 0, 1)).toBe(1);
    expect(stepSkuQuantity(carton, 1, 1)).toBe(2);
    expect(stepSkuQuantity(carton, 1, -1)).toBe(0);

    const kg = { moq: 10, quantityStep: 10, stock: 200 };
    expect(stepSkuQuantity(kg, 0, 1)).toBe(10);
    expect(stepSkuQuantity(kg, 10, 1)).toBe(20);
    expect(stepSkuQuantity(kg, 10, -1)).toBe(0);
  });
});
