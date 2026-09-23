import { describe, expect, it } from 'vitest';
import {
  lineTotalWithOuterQuantityDiscount,
  resolveOuterDiscountPerUnit,
  validateOuterDiscountTiers,
} from './outer-quantity-discount';

const TIERS = [
  { minOuterQuantity: 5, discountPerOuterUnit: 5 },
  { minOuterQuantity: 10, discountPerOuterUnit: 7 },
];

describe('resolveOuterDiscountPerUnit', () => {
  it('4 Bags → no discount', () => {
    expect(resolveOuterDiscountPerUnit(4, TIERS).discountPerOuterUnit).toBe(0);
  });

  it('5 Bags → ₹5 per Bag', () => {
    expect(resolveOuterDiscountPerUnit(5, TIERS).discountPerOuterUnit).toBe(5);
  });

  it('9 Bags → ₹5 per Bag', () => {
    expect(resolveOuterDiscountPerUnit(9, TIERS).discountPerOuterUnit).toBe(5);
  });

  it('10 Bags → ₹7 per Bag', () => {
    expect(resolveOuterDiscountPerUnit(10, TIERS).discountPerOuterUnit).toBe(7);
  });

  it('20 Bags → ₹7 per Bag', () => {
    expect(resolveOuterDiscountPerUnit(20, TIERS).discountPerOuterUnit).toBe(7);
  });
});

describe('lineTotalWithOuterQuantityDiscount', () => {
  const base = {
    packRegularPrice: 166,
    containerRegularPrice: 1660,
    packsPerOuter: 10,
    tiers: TIERS,
  };

  it('4 Bags (40 packs) → no discount', () => {
    const r = lineTotalWithOuterQuantityDiscount({ ...base, quantityPacks: 40 });
    expect(r).toMatchObject({
      outerUnitCount: 4,
      subtotal: 6640,
      quantityDiscountTotal: 0,
      lineTotal: 6640,
    });
  });

  it('5 Bags → ₹5 × 5 = ₹25 off', () => {
    const r = lineTotalWithOuterQuantityDiscount({ ...base, quantityPacks: 50 });
    expect(r).toMatchObject({
      outerUnitCount: 5,
      subtotal: 8300,
      quantityDiscountTotal: 25,
      lineTotal: 8275,
    });
  });

  it('9 Bags → ₹5 × 9', () => {
    const r = lineTotalWithOuterQuantityDiscount({ ...base, quantityPacks: 90 });
    expect(r).toMatchObject({
      outerUnitCount: 9,
      subtotal: 14940,
      quantityDiscountTotal: 45,
      lineTotal: 14895,
    });
  });

  it('10 Bags → ₹7 × 10 = ₹70', () => {
    const r = lineTotalWithOuterQuantityDiscount({ ...base, quantityPacks: 100 });
    expect(r).toMatchObject({
      quantityDiscountTotal: 70,
      lineTotal: 16530,
    });
  });

  it('20 Bags → ₹7 × 20', () => {
    const r = lineTotalWithOuterQuantityDiscount({ ...base, quantityPacks: 200 });
    expect(r).toMatchObject({
      quantityDiscountTotal: 140,
      lineTotal: 33200 - 140,
    });
  });

  it('no outer packaging → pack pricing only', () => {
    const r = lineTotalWithOuterQuantityDiscount({
      quantityPacks: 5,
      packRegularPrice: 166,
      tiers: TIERS,
    });
    expect(r).toMatchObject({ lineTotal: 830, quantityDiscountTotal: 0 });
  });
});

describe('validateOuterDiscountTiers', () => {
  it('warns when higher qty has worse discount', () => {
    expect(
      validateOuterDiscountTiers([
        { minOuterQuantity: 5, discountPerOuterUnit: 7 },
        { minOuterQuantity: 10, discountPerOuterUnit: 5 },
      ]),
    ).toMatch(/worse deal/);
  });
});
