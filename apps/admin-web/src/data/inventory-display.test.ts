import { describe, expect, it } from 'vitest';
import {
  buildInventoryStockLabels,
  formatInventoryPackagingLabel,
  inventoryOuterLabel,
} from './inventory-display';

describe('inventory-display', () => {
  it('formats packaging from SKU config without hardcoding Bag', () => {
    expect(
      formatInventoryPackagingLabel({
        netQuantity: 5,
        netQuantityUnit: 'kg',
        packsPerOuter: 10,
        outerType: 'bag',
      }),
    ).toContain('Bag');

    expect(
      formatInventoryPackagingLabel({
        netQuantity: 1,
        netQuantityUnit: 'l',
        packsPerOuter: 12,
        outerType: 'box',
      }),
    ).toContain('Box');
  });

  it('builds mixed stock labels for outer + loose packs', () => {
    const labels = buildInventoryStockLabels(55, {
      netQuantity: 5,
      netQuantityUnit: 'kg',
      packsPerOuter: 10,
      outerType: 'bag',
    });
    expect(labels.mixedLabel).toMatch(/5 Bags/i);
    expect(labels.packsTotalLabel).toMatch(/55/);
    expect(labels.weightLabel).toMatch(/kg/i);
  });

  it('uses dynamic outer labels', () => {
    expect(inventoryOuterLabel('carton', 1)).toBe('Carton');
    expect(inventoryOuterLabel('carton', 2).toLowerCase()).toContain('carton');
  });
});
