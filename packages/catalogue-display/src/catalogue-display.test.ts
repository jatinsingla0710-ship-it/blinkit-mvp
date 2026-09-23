import { describe, expect, it } from 'vitest';
import {
  buildMixedInventoryDisplay,
  buildPackagingSummary,
  decomposePacksToOuter,
  totalWeightGrams,
} from './packaging';
import {
  buildTierDisplayRows,
  lineTotalForQuantity,
  resolveUnitPriceForQuantity,
} from './pricing';

describe('packaging display', () => {
  it('decomposes 53 pieces into 5 bags + 3 pieces when 10 per bag', () => {
    const result = buildMixedInventoryDisplay({
      totalPacks: 53,
      netQuantity: 5,
      netQuantityUnit: 'kg',
      packsPerOuter: 10,
      outerType: 'bag',
    });
    expect(result.fullOuters).toBe(5);
    expect(result.loosePacks).toBe(3);
    expect(result.mixedLabel).toBe('5 Bags + 3 Packs');
    expect(result.totalWeightLabel).toBe('265 kg');
  });

  it('calculates total weight from pack config', () => {
    const grams = totalWeightGrams({
      totalPacks: 10,
      netQuantity: 5,
      netQuantityUnit: 'kg',
    });
    expect(grams).toBe(50_000);
  });

  it('validates packaging summary for atta example', () => {
    const summary = buildPackagingSummary({
      netQuantity: 5,
      netQuantityUnit: 'kg',
      packsPerOuter: 10,
      outerType: 'bag',
    });
    expect(summary.weightPerPieceLabel).toBe('5 kg');
    expect(summary.weightPerOuterLabel).toBe('50 kg');
    expect(summary.isValid).toBe(true);
  });

  it('decomposePacksToOuter returns loose only when no outer config', () => {
    expect(decomposePacksToOuter({ totalPacks: 7, packsPerOuter: 0 })).toEqual({
      fullOuters: 0,
      loosePacks: 7,
    });
  });
});

describe('quantity pricing', () => {
  const base = 166;
  const tiers = [
    { minQuantity: 5, unitPrice: 160 },
    { minQuantity: 10, unitPrice: 150 },
  ];

  it('uses base price below first tier', () => {
    expect(resolveUnitPriceForQuantity(3, base, tiers).unitPrice).toBe(166);
  });

  it('applies 5+ tier', () => {
    expect(resolveUnitPriceForQuantity(7, base, tiers).unitPrice).toBe(160);
  });

  it('applies 10+ tier for full bag', () => {
    expect(resolveUnitPriceForQuantity(10, base, tiers).unitPrice).toBe(150);
  });

  it('calculates line total with tier', () => {
    const result = lineTotalForQuantity(7, base, tiers);
    expect(result.unitPrice).toBe(160);
    expect(result.lineTotal).toBe(1120);
    expect(result.tierApplied).toBe(true);
  });

  it('builds admin tier display rows with savings', () => {
    const rows = buildTierDisplayRows({
      baseUnitPrice: 166,
      baseUnitLabel: 'Piece',
      tiers,
    });
    expect(rows).toHaveLength(3);
    expect(rows[1].savings).toBe(30);
    expect(rows[2].savings).toBe(160);
  });
});
