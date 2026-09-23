import { describe, expect, it } from 'vitest';
import {
  deriveSellingUnitCode,
  isPriceBasisCompatible,
  minimumOrderSummary,
  mixedInventorySummary,
  mixedStockToPacks,
  moqToBasePacks,
  outerPackagingSummary,
  priceBasesForPackUnit,
  roundMoney,
} from './pack-units';
import {
  packTradePriceFromBasis,
  packsPerOuterFromCount,
} from './sku-pack-pricing';
import { openingStockToPackQuantity, formatInitialInventoryPreview } from './product-create-helpers';

describe('pack unit compatibility', () => {
  it('g allows per_g / per_kg / per_pack only', () => {
    expect(priceBasesForPackUnit('g')).toEqual(['per_g', 'per_kg', 'per_pack']);
    expect(isPriceBasisCompatible('g', 'per_kg')).toBe(true);
    expect(isPriceBasisCompatible('g', 'per_bottle')).toBe(false);
  });

  it('litre rejects per_kg', () => {
    expect(isPriceBasisCompatible('litre', 'per_kg')).toBe(false);
    expect(isPriceBasisCompatible('litre', 'per_litre')).toBe(true);
  });

  it('pcs only allows piece-compatible bases', () => {
    expect(priceBasesForPackUnit('pcs')).toEqual(['per_piece', 'per_pack']);
    expect(isPriceBasisCompatible('pcs', 'per_kg')).toBe(false);
  });

  it('derives selling_unit from pack unit for order snapshots', () => {
    expect(deriveSellingUnitCode('g')).toBe('PACK');
    expect(deriveSellingUnitCode('bottle')).toBe('BOTTLE');
    expect(deriveSellingUnitCode('kg')).toBe('KG');
  });
});

describe('pack trade price calculations', () => {
  it('250 g @ ₹800/kg = ₹200/pack', () => {
    expect(
      packTradePriceFromBasis({
        basisPrice: 800,
        priceBasis: 'per_kg',
        packQuantity: 250,
        packUnit: 'g',
      }),
    ).toEqual({ packTradePrice: 200 });
  });

  it('500 ml @ ₹120/litre = ₹60/pack', () => {
    expect(
      packTradePriceFromBasis({
        basisPrice: 120,
        priceBasis: 'per_litre',
        packQuantity: 500,
        packUnit: 'ml',
      }),
    ).toEqual({ packTradePrice: 60 });
  });

  it('rejects litre pack with per_kg basis', () => {
    expect(
      packTradePriceFromBasis({
        basisPrice: 100,
        priceBasis: 'per_kg',
        packQuantity: 1,
        packUnit: 'litre',
      }),
    ).toMatchObject({ error: expect.stringContaining('not valid') });
  });

  it('rounds money consistently', () => {
    expect(roundMoney(200.005)).toBe(200.01);
  });
});

describe('outer packaging (packs per outer)', () => {
  it('8 packs of 250 g → 2 kg total', () => {
    expect(packsPerOuterFromCount(8)).toEqual({ packsPerBox: 8 });
    expect(
      outerPackagingSummary({
        packQuantity: 250,
        packUnit: 'g',
        packsPerOuter: 8,
        outerType: 'box',
      }),
    ).toEqual({
      packsLine: '8 packs per box',
      contentsLine: 'Total contents: 2 kg',
    });
  });

  it('12 packs of 1 litre → 12 litres total', () => {
    expect(
      outerPackagingSummary({
        packQuantity: 1,
        packUnit: 'litre',
        packsPerOuter: 12,
        outerType: 'carton',
      }),
    ).toEqual({
      packsLine: '12 packs per carton',
      contentsLine: 'Total contents: 12 litres',
    });
  });
});

describe('minimum order + initial inventory labels', () => {
  it('shows dynamic MOQ for 250 g packs', () => {
    expect(
      minimumOrderSummary({
        moq: 5,
        packQuantity: 250,
        packUnit: 'g',
      }),
    ).toBe('Minimum order: 5 packs (1.25 kg total)');
  });

  it('shows bottles for bottle pack unit', () => {
    expect(
      minimumOrderSummary({
        moq: 12,
        packQuantity: 1,
        packUnit: 'bottle',
      }),
    ).toBe('Minimum order: 12 bottles');
  });

  it('converts MOQ in boxes to base packs', () => {
    expect(
      moqToBasePacks({
        quantity: 2,
        moqUnit: 'box',
        packsPerOuter: 8,
      }),
    ).toEqual({ packs: 16 });
    expect(
      minimumOrderSummary({
        moq: 16,
        packQuantity: 250,
        packUnit: 'g',
        packsPerOuter: 8,
        outerType: 'box',
        displayUnit: 'box',
        displayQuantity: 2,
      }),
    ).toBe('Minimum order: 2 boxes (= 16 packs) (4 kg total)');
  });

  it('initial inventory stores pack counts', () => {
    expect(
      openingStockToPackQuantity({
        quantity: 100,
        unit: 'packs',
        packQuantity: 250,
        packUnit: 'g',
      }),
    ).toEqual({ onHandPacks: 100 });
  });

  it('initial inventory preview shows pack × content total', () => {
    expect(
      formatInitialInventoryPreview({
        quantity: 100,
        unit: 'packs',
        packQuantity: 250,
        packUnit: 'g',
      }),
    ).toBe('100 packs × 250 g = 25 kg total');
  });

  it('mixed inventory: 10 boxes + 5 loose = 85 packs', () => {
    expect(
      mixedStockToPacks({
        outerCount: 10,
        loosePacks: 5,
        packsPerOuter: 8,
      }),
    ).toEqual({ onHandPacks: 85 });
    expect(
      mixedInventorySummary({
        totalPacks: 85,
        packsPerOuter: 8,
        outerType: 'box',
        packQuantity: 250,
        packUnit: 'g',
      }),
    ).toContain('10 full boxes');
    expect(
      mixedInventorySummary({
        totalPacks: 85,
        packsPerOuter: 8,
        outerType: 'box',
        packQuantity: 250,
        packUnit: 'g',
      }),
    ).toContain('5 loose packs');
    expect(
      mixedInventorySummary({
        totalPacks: 85,
        packsPerOuter: 8,
        outerType: 'box',
        packQuantity: 250,
        packUnit: 'g',
      }),
    ).toContain('21.25 kg total');
  });

  it('legacy mass stock still converts to packs', () => {
    expect(
      openingStockToPackQuantity({
        quantity: 25,
        unit: 'kg',
        packQuantity: 250,
        packUnit: 'g',
      }),
    ).toEqual({ onHandPacks: 100 });
  });
});
