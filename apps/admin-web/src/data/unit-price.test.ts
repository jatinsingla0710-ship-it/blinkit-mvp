import { describe, expect, it } from 'vitest';
import { deriveUnitPrice } from './unit-price';

describe('deriveUnitPrice', () => {
  it('treats trade price as pack price and derives ₹/kg reference', () => {
    const result = deriveUnitPrice({
      tradePrice: 1500,
      netQuantity: 30,
      netQuantityUnit: 'kg',
    });
    expect(result).toMatchObject({
      packQuantity: 30,
      packUnitLabel: 'kg',
      packTradePrice: 1500,
      unitPrice: 50,
    });
    expect(result?.unitPriceLabel).toContain('50');
    expect(result?.unitPriceLabel).toContain('kg');
    expect(result?.packTradePriceLabel).toContain('1,500');
  });

  it('calculates piece-based reference from pack trade price', () => {
    const result = deriveUnitPrice({
      tradePrice: 600,
      netQuantity: 12,
      netQuantityUnit: 'pieces',
    });
    expect(result?.unitPrice).toBe(50);
    expect(result?.unitPriceLabel.toLowerCase()).toContain('piece');
  });

  it('returns null for zero pack quantity', () => {
    expect(
      deriveUnitPrice({
        tradePrice: 1500,
        netQuantity: 0,
        netQuantityUnit: 'kg',
      }),
    ).toBeNull();
  });

  it('returns null when pack quantity is missing', () => {
    expect(
      deriveUnitPrice({
        tradePrice: 1500,
        netQuantity: null,
        netQuantityUnit: 'kg',
      }),
    ).toBeNull();
  });

  it('returns null for negative trade price', () => {
    expect(
      deriveUnitPrice({
        tradePrice: -10,
        netQuantity: 30,
        netQuantityUnit: 'kg',
      }),
    ).toBeNull();
  });

  it('250 g pack @ ₹250 trade → ₹1,000/kg reference', () => {
    const result = deriveUnitPrice({
      tradePrice: 250,
      netQuantity: 250,
      netQuantityUnit: 'g',
    });
    expect(result?.packTradePrice).toBe(250);
    expect(result?.unitPrice).toBe(1000);
  });
});
