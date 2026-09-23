import { describe, expect, it } from 'vitest';
import {
  basisPriceFromPackTrade,
  boxValueFromPacks,
  buildSkuCommercialBreakdown,
  packTradePriceFromBasis,
  packsPerBoxFromQuantities,
  toGrams,
  toKilograms,
} from './sku-pack-pricing';
import { deriveUnitPrice } from './unit-price';

describe('sku-pack-pricing — required almond example', () => {
  it('250 g @ ₹1,000/kg = ₹250/pack', () => {
    const result = packTradePriceFromBasis({
      basisPrice: 1000,
      priceBasis: 'per_kg',
      packQuantity: 250,
      packUnit: 'g',
    });
    expect(result).toEqual({ packTradePrice: 250 });
  });

  it('12 kg box = 48 × 250 g packs', () => {
    const result = packsPerBoxFromQuantities({
      packQuantity: 250,
      packUnit: 'g',
      boxQuantity: 12,
      boxUnit: 'kg',
    });
    expect(result).toEqual({ packsPerBox: 48 });
  });

  it('48 × ₹250 = ₹12,000 box value', () => {
    const result = boxValueFromPacks({
      packTradePrice: 250,
      packsPerBox: 48,
    });
    expect(result).toEqual({ boxValue: 12000 });
  });

  it('builds full commercial breakdown for the almond example', () => {
    const breakdown = buildSkuCommercialBreakdown({
      packQuantity: 250,
      packUnit: 'g',
      packTradePrice: 250,
      packsPerBox: 48,
    });
    expect(breakdown).toMatchObject({
      packLabel: '250 g',
      packTradePrice: 250,
      referencePrice: 1000,
      packsPerBox: 48,
      boxValue: 12000,
    });
    expect(breakdown?.packTradePriceLabel).toContain('250');
    expect(breakdown?.referenceLabel).toContain('1,000');
    expect(breakdown?.boxLabel).toBe('12 kg');
    expect(breakdown?.boxValueLabel).toContain('12,000');
  });
});

describe('sku-pack-pricing — unit conversion', () => {
  it('converts kg ↔ g', () => {
    expect(toKilograms(250, 'g')).toBe(0.25);
    expect(toGrams(12, 'kg')).toBe(12000);
    expect(toKilograms(1, 'kg')).toBe(1);
  });

  it('rejects zero pack quantity', () => {
    expect(
      packTradePriceFromBasis({
        basisPrice: 1000,
        priceBasis: 'per_kg',
        packQuantity: 0,
        packUnit: 'g',
      }),
    ).toEqual({ error: 'Pack quantity must be greater than zero' });
    expect(
      packsPerBoxFromQuantities({
        packQuantity: 0,
        packUnit: 'g',
        boxQuantity: 12,
        boxUnit: 'kg',
      }),
    ).toEqual({ error: 'Pack quantity must be greater than zero' });
  });

  it('rejects negative quantities', () => {
    expect(
      packTradePriceFromBasis({
        basisPrice: 1000,
        priceBasis: 'per_kg',
        packQuantity: -250,
        packUnit: 'g',
      }),
    ).toEqual({ error: 'Pack quantity must be greater than zero' });
    expect(
      packsPerBoxFromQuantities({
        packQuantity: 250,
        packUnit: 'g',
        boxQuantity: -12,
        boxUnit: 'kg',
      }),
    ).toEqual({ error: 'Box quantity must be greater than zero' });
  });

  it('rejects incompatible price basis for pack unit', () => {
    expect(
      packsPerBoxFromQuantities({
        packQuantity: 250,
        packUnit: 'g',
        boxQuantity: 12,
        boxUnit: 'pcs',
      }),
    ).toMatchObject({
      error: expect.stringContaining('compatible'),
    });
    expect(
      packTradePriceFromBasis({
        basisPrice: 10,
        priceBasis: 'per_kg',
        packQuantity: 2,
        packUnit: 'pcs',
      }),
    ).toMatchObject({
      error: expect.stringMatching(/mass|not valid/),
    });
  });

  it('supports piece-based SKU calculation', () => {
    const pack = packTradePriceFromBasis({
      basisPrice: 50,
      priceBasis: 'per_piece',
      packQuantity: 12,
      packUnit: 'pcs',
    });
    expect(pack).toEqual({ packTradePrice: 600 });

    const packs = packsPerBoxFromQuantities({
      packQuantity: 12,
      packUnit: 'pcs',
      boxQuantity: 144,
      boxUnit: 'pcs',
    });
    expect(packs).toEqual({ packsPerBox: 12 });

    const box = boxValueFromPacks({
      packTradePrice: 600,
      packsPerBox: 12,
    });
    expect(box).toEqual({ boxValue: 7200 });
  });

  it('round-trips pack trade ↔ basis for existing compatible data', () => {
    const toPack = packTradePriceFromBasis({
      basisPrice: 1000,
      priceBasis: 'per_kg',
      packQuantity: 250,
      packUnit: 'g',
    });
    expect(toPack).toEqual({ packTradePrice: 250 });
    if ('error' in toPack) return;

    const back = basisPriceFromPackTrade({
      packTradePrice: toPack.packTradePrice,
      priceBasis: 'per_kg',
      packQuantity: 250,
      packUnit: 'g',
    });
    expect(back).toEqual({ basisPrice: 1000 });
  });
});

describe('pricing display uses the same calculation', () => {
  it('deriveUnitPrice shows ₹250/pack with ₹1,000/kg reference', () => {
    const result = deriveUnitPrice({
      tradePrice: 250,
      netQuantity: 250,
      netQuantityUnit: 'g',
    });
    expect(result?.packTradePrice).toBe(250);
    expect(result?.unitPrice).toBe(1000);
    expect(result?.unitPriceLabel).toContain('1,000');
    expect(result?.packTradePriceLabel).toContain('250');
  });

  it('existing 30 kg bag @ ₹1,500 remains compatible as ₹50/kg reference', () => {
    const result = deriveUnitPrice({
      tradePrice: 1500,
      netQuantity: 30,
      netQuantityUnit: 'kg',
    });
    expect(result?.packTradePrice).toBe(1500);
    expect(result?.unitPrice).toBe(50);
  });
});
