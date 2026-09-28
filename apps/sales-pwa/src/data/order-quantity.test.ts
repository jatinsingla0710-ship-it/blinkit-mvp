import { describe, expect, it } from 'vitest';
import {
  commitTypedQuantity,
  isValidOrderQuantity,
  maxOrderQuantity,
  minOrderQuantity,
  outerBreakdownLabel,
  packInfoLabel,
  sellingQuantityLabel,
  stepDown,
  stepUp,
} from './order-quantity';

const bagSku = {
  moq: 5,
  quantityStep: 5,
  packsPerCarton: 10,
  outerType: 'bag',
  netQuantityUnit: 'kg',
  sellingUnit: 'PACK',
};

describe('stepper rules match place_assisted_order (G)', () => {
  it('starts at the smallest server-valid quantity and steps by quantity_step', () => {
    expect(minOrderQuantity(bagSku)).toBe(5);
    expect(stepUp(bagSku, 0, 100)).toBe(5);
    expect(stepUp(bagSku, 5, 100)).toBe(10);
    expect(stepDown(bagSku, 10)).toBe(5);
    expect(stepDown(bagSku, 5)).toBe(0);
  });

  it('uses mod(qty, step) = 0, not moq + n*step (MOQ 5, step 10)', () => {
    const sku = { moq: 5, quantityStep: 10 };
    expect(minOrderQuantity(sku)).toBe(10);
    expect(isValidOrderQuantity(sku, 15)).toBe(false);
    expect(isValidOrderQuantity(sku, 20)).toBe(true);
    expect(stepUp(sku, 0, 100)).toBe(10);
    expect(stepUp(sku, 10, 100)).toBe(20);
  });

  it('never steps above available stock', () => {
    expect(maxOrderQuantity(bagSku, 23)).toBe(20);
    expect(stepUp(bagSku, 20, 23)).toBe(20);
    expect(maxOrderQuantity(bagSku, 4)).toBe(0);
    expect(stepUp(bagSku, 0, 4)).toBe(0);
  });
});

describe('pack to bag display (H)', () => {
  it('shows 50 packs = 5 bags while the quantity stays 50 packs', () => {
    expect(sellingQuantityLabel(bagSku, 50)).toBe('50 Packs');
    expect(outerBreakdownLabel(bagSku, 50)).toBe('= 5 Bags');
  });

  it('shows loose packs next to full bags', () => {
    expect(outerBreakdownLabel(bagSku, 55)).toBe('= 5 Bags + 5 Packs');
    expect(outerBreakdownLabel(bagSku, 10)).toBe('= 1 Bag');
  });

  it('has no breakdown for SKUs without an outer pack', () => {
    expect(outerBreakdownLabel({ ...bagSku, packsPerCarton: undefined }, 50)).toBeNull();
    expect(packInfoLabel({ ...bagSku, packsPerCarton: undefined })).toBeNull();
  });

  it('describes the pack configuration', () => {
    expect(packInfoLabel(bagSku)).toBe('10 Packs per Bag');
  });
});

describe('invalid quantity prevention (I)', () => {
  it('rounds typed quantities up to the next valid step', () => {
    expect(commitTypedQuantity(bagSku, '12', 100)).toEqual({
      quantity: 15,
      adjustedReason: 'Quantity must be in steps of 5.',
    });
  });

  it('raises typed quantities below MOQ to the minimum', () => {
    expect(commitTypedQuantity(bagSku, '2', 100)).toEqual({
      quantity: 5,
      adjustedReason: 'Minimum order is 5.',
    });
  });

  it('caps typed quantities at stock', () => {
    expect(commitTypedQuantity(bagSku, '500', 42)).toEqual({
      quantity: 40,
      adjustedReason: 'Only 40 can be ordered from current stock.',
    });
  });

  it('rejects zero, negative and non-numeric input', () => {
    expect(commitTypedQuantity(bagSku, '0', 100).quantity).toBe(0);
    expect(commitTypedQuantity(bagSku, '-5', 100).quantity).toBe(0);
    expect(commitTypedQuantity(bagSku, 'abc', 100).quantity).toBe(0);
    expect(commitTypedQuantity(bagSku, '', 100)).toEqual({ quantity: 0, adjustedReason: null });
  });

  it('keeps valid typed quantities unchanged', () => {
    expect(commitTypedQuantity(bagSku, '50', 100)).toEqual({ quantity: 50, adjustedReason: null });
  });

  it('refuses when stock cannot cover the minimum', () => {
    expect(commitTypedQuantity(bagSku, '5', 3)).toEqual({
      quantity: 0,
      adjustedReason: 'Not enough stock to order this item.',
    });
  });
});
