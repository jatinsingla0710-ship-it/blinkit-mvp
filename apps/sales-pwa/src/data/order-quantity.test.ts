import { describe, expect, it } from 'vitest';
import {
  commitTypedQuantity,
  displayUnitPrice,
  formatOrderQuantity,
  isValidOrderQuantity,
  maxOrderQuantity,
  minOrderQuantity,
  orderRulesLabel,
  outerBreakdownLabel,
  packInfoLabel,
  skuSellsInOuterUnits,
  stepDown,
  stepUp,
  toOrderUnits,
  toPackQuantity,
} from './order-quantity';

const bagSku = {
  moq: 5,
  quantityStep: 5,
  packsPerCarton: 10,
  outerType: 'bag',
  netQuantityUnit: 'kg',
  sellingUnit: 'PACK',
};

/** Badam Box: sell by Box, 40 packs/box, min 1 box, step 1 box. */
const boxSku = {
  moq: 40,
  quantityStep: 40,
  packsPerCarton: 40,
  outerType: 'box',
  netQuantityUnit: 'g',
  sellingUnit: 'BOX',
  containerPriceMode: 'custom' as const,
  containerCustomPrice: 250,
};

const kgSku = {
  moq: 1,
  quantityStep: 0.5,
  sellingUnit: 'KG',
  netQuantityUnit: 'kg',
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

describe('sell by outer (Box) — UI units vs pack inventory', () => {
  it('detects box-selling when moq/step are outer multiples', () => {
    expect(skuSellsInOuterUnits(boxSku)).toBe(true);
    expect(skuSellsInOuterUnits(bagSku)).toBe(false); // step 5 packs, not full bag steps only for outer UI
  });

  it('converts 1 Box ↔ 40 packs and 2 Boxes ↔ 80 packs', () => {
    expect(toPackQuantity(boxSku, 1)).toBe(40);
    expect(toPackQuantity(boxSku, 2)).toBe(80);
    expect(toOrderUnits(boxSku, 40)).toBe(1);
    expect(toOrderUnits(boxSku, 80)).toBe(2);
  });

  it('labels quantity as Boxes and price as / Box', () => {
    expect(formatOrderQuantity(boxSku, 80)).toBe('2 Boxes');
    expect(displayUnitPrice(boxSku, 6.25)).toEqual({
      price: 250,
      unitLabel: 'Box',
    });
    expect(orderRulesLabel(boxSku)).toContain('Minimum 1 Box');
  });

  it('accepts typed Box qty and stores packs', () => {
    expect(commitTypedQuantity(boxSku, '2', 200)).toEqual({
      quantity: 80,
      adjustedReason: null,
    });
    expect(commitTypedQuantity(boxSku, '0.5', 200).quantity).toBe(40);
  });
});

describe('KG selling unit', () => {
  it('allows 0.5 steps and labels Kg', () => {
    expect(isValidOrderQuantity(kgSku, 1.5)).toBe(true);
    expect(isValidOrderQuantity(kgSku, 1.25)).toBe(false);
    expect(formatOrderQuantity(kgSku, 1.5)).toBe('1.5 Kg');
    expect(displayUnitPrice(kgSku, 850).unitLabel).toBe('Kg');
  });
});

describe('pack to bag display (H)', () => {
  it('shows pack qty with optional outer breakdown when not selling by outer', () => {
    expect(formatOrderQuantity(bagSku, 50)).toBe('50 Packs');
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

  it('hides outer breakdown when already selling in outers', () => {
    expect(outerBreakdownLabel(boxSku, 80)).toBeNull();
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
      adjustedReason: 'Minimum order is 5 Packs.',
    });
  });

  it('caps typed quantities at stock', () => {
    expect(commitTypedQuantity(bagSku, '500', 42)).toEqual({
      quantity: 40,
      adjustedReason: 'Only 40 Packs can be ordered from current stock.',
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
