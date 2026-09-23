import { describe, expect, it } from 'vitest';
import {
  buildMixedInventoryDisplay,
  buildPricingBreakdown,
} from '@groaurum/catalogue-display';
import { moqToBasePacks } from '@/data/pack-units';

describe('business packaging cases', () => {
  it('Case 1 — Atta: 55 packs → 5 Bags + 5 Packs, pricing', () => {
    const inv = buildMixedInventoryDisplay({
      totalPacks: 55,
      netQuantity: 5,
      netQuantityUnit: 'kg',
      packsPerOuter: 10,
      outerType: 'bag',
    });
    expect(inv.mixedLabel).toBe('5 Bags + 5 Packs');
    expect(inv.totalWeightLabel).toBe('275 kg');

    const pricing = buildPricingBreakdown({
      baseUnitPrice: 166,
      baseUnitLabel: 'Pack',
      packsPerOuter: 10,
      outerUnitLabel: 'Bag',
    });
    expect(pricing.outerUnitPrice).toBe(1660);
  });

  it('Case 2 — Oil: 29 bottles → 2 Cartons + 5 Bottles', () => {
    const inv = buildMixedInventoryDisplay({
      totalPacks: 29,
      netQuantity: 1,
      netQuantityUnit: 'bottle',
      packsPerOuter: 12,
      outerType: 'carton',
    });
    expect(inv.mixedLabel).toBe('2 Cartons + 5 Bottles');
  });

  it('Case 3 — Container minimum order: 1 Bag = 10 packs MOQ', () => {
    const result = moqToBasePacks({
      quantity: 1,
      moqUnit: 'bag',
      packsPerOuter: 10,
    });
    expect(result).toEqual({ packs: 10 });
  });

  it('Case 4 — Pack minimum order: 2 packs', () => {
    const result = moqToBasePacks({
      quantity: 2,
      moqUnit: 'packs',
      packsPerOuter: 10,
    });
    expect(result).toEqual({ packs: 2 });
  });
});
