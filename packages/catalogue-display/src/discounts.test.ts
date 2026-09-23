import { describe, expect, it } from 'vitest';
import {
  applyDiscount,
  buildPackContainerPricing,
  lineTotalWithPackagingSplit,
  validateDiscountInput,
} from './discounts';

describe('applyDiscount', () => {
  it('Test A — no discount', () => {
    const result = applyDiscount(166, 'none', 0);
    expect(result).toMatchObject({ finalPrice: 166, discountAmount: 0 });
  });

  it('Test B — pack percentage discount', () => {
    const result = applyDiscount(166, 'percent', 10);
    expect(result).toMatchObject({
      regularPrice: 166,
      discountAmount: 16.6,
      finalPrice: 149.4,
    });
  });

  it('Test C — pack fixed discount', () => {
    const result = applyDiscount(166, 'fixed', 20);
    expect(result).toMatchObject({ finalPrice: 146, discountAmount: 20 });
  });

  it('Test G — rejects invalid discounts', () => {
    expect(validateDiscountInput(166, 'percent', 110)).toMatch(/100%/);
    expect(validateDiscountInput(166, 'fixed', -1)).toMatch(/negative/);
    expect(validateDiscountInput(1660, 'fixed', 2000)).toMatch(/exceed/);
  });
});

describe('container pricing', () => {
  const config = {
    packDiscountType: 'none' as const,
    packDiscountValue: 0,
    containerPriceMode: 'calculated' as const,
    containerDiscountType: 'fixed' as const,
    containerDiscountValue: 60,
  };

  it('Test D — bag discount', () => {
    const pricing = buildPackContainerPricing({
      regularPackPrice: 166,
      packsPerOuter: 10,
      config,
    });
    expect(pricing).toMatchObject({
      containerRegularPrice: 1660,
      containerFinalPrice: 1600,
      packFinalPrice: 166,
    });
  });

  it('Test E — custom bag price', () => {
    const pricing = buildPackContainerPricing({
      regularPackPrice: 166,
      packsPerOuter: 10,
      config: {
        ...config,
        containerPriceMode: 'custom',
        containerCustomPrice: 1550,
        containerDiscountType: 'none',
        containerDiscountValue: 0,
      },
    });
    expect(pricing).toMatchObject({
      containerRegularPrice: 1550,
      containerFinalPrice: 1550,
    });
  });

  it('Test F — independent pack and bag discounts', () => {
    const pricing = buildPackContainerPricing({
      regularPackPrice: 166,
      packsPerOuter: 10,
      config,
    });
    expect(pricing).toMatchObject({
      packFinalPrice: 166,
      containerFinalPrice: 1600,
    });
  });

  it('line total for one full bag', () => {
    const total = lineTotalWithPackagingSplit({
      quantity: 10,
      regularPackPrice: 166,
      packsPerOuter: 10,
      config,
    });
    expect(total).toMatchObject({ lineTotal: 1600 });
  });

  it('line total for mixed bag + loose packs', () => {
    const total = lineTotalWithPackagingSplit({
      quantity: 12,
      regularPackPrice: 166,
      packsPerOuter: 10,
      config,
    });
    expect(total).toMatchObject({ lineTotal: 1932, fullContainers: 1, loosePacks: 2 });
  });
});
