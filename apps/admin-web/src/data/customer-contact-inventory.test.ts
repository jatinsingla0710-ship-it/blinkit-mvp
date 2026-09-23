import { describe, expect, it } from 'vitest';

import {
  formatEditMobileConflictWarning,
  normalizeMobileForLookup,
} from '@/data/customer-mobile-lookup';
import { customerContactUpdateSchema } from '@groaurum/validation';
import {
  buildInventoryOverview,
  formatAvailableStockLabel,
  formatPackagingLabel,
  previewAdjustmentPacks,
} from '@/data/product-inventory-display';

describe('customer contact update', () => {
  it('normalizes indian mobile for lookup', () => {
    expect(normalizeMobileForLookup('9876543210')).toBe('+919876543210');
  });

  it('validates contact update schema', () => {
    const parsed = customerContactUpdateSchema.safeParse({
      ownerName: 'Rajesh Kumar',
      ownerMobile: '9876543210',
      ownerEmail: 'raj@example.com',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.ownerMobile).toBe('+919876543210');
    }
  });

  it('warns when editing to a mobile used by another shop', () => {
    const warning = formatEditMobileConflictWarning(
      [
        {
          shopId: 'other-shop',
          shopName: 'Other Traders',
          ownerName: 'Other',
          mobile: '+919876543210',
          isActive: true,
        },
      ],
      'current-shop',
    );
    expect(warning).toContain('Other Traders');
  });

  it('ignores current shop in duplicate warning', () => {
    const warning = formatEditMobileConflictWarning(
      [
        {
          shopId: 'current-shop',
          shopName: 'Same Shop',
          ownerName: 'Raj',
          mobile: '+919876543210',
          isActive: true,
        },
      ],
      'current-shop',
    );
    expect(warning).toBe('');
  });
});

describe('product inventory display', () => {
  it('formats weight-based available stock', () => {
    const label = formatAvailableStockLabel({
      availablePacks: 1000,
      netQuantity: 200,
      netQuantityUnit: 'g',
    });
    expect(label).toContain('kg available');
  });

  it('builds packaging label from sku config', () => {
    const label = formatPackagingLabel({
      productName: 'Gold Blend',
      netQuantity: 200,
      netQuantityUnit: 'g',
      packsPerOuter: 5,
      variantLabel: 'Gold Blend',
    });
    expect(label).toContain('200 g');
    expect(label).toContain('5 packs per Box');
  });

  it('builds inventory overview with outer and pack equivalents', () => {
    const overview = buildInventoryOverview({
      availablePacks: 100,
      netQuantity: 200,
      netQuantityUnit: 'g',
      packsPerOuter: 5,
    });
    expect(overview.totalAvailableLabel).toContain('kg');
    expect(overview.equivalents.length).toBeGreaterThan(0);
  });

  it('previews outer to pack conversion for adjustments', () => {
    const preview = previewAdjustmentPacks({
      quantity: 2,
      unit: 'outer',
      packsPerOuter: 20,
      outerType: 'bag',
    });
    expect(preview).toEqual({
      packs: 40,
      preview: '2 Bags = 40 packs',
    });
  });

  it('previews outer conversion with pack weight', () => {
    const preview = previewAdjustmentPacks({
      quantity: 5,
      unit: 'outer',
      packsPerOuter: 10,
      outerType: 'bag',
      netQuantity: 5,
      netQuantityUnit: 'kg',
    });
    expect(preview).toEqual({
      packs: 50,
      preview: '5 Bags = 50 packs = 250 kg',
    });
  });

  it('does not double-count pack conversion', () => {
    const overview = buildInventoryOverview({
      availablePacks: 10,
      netQuantity: 1,
      netQuantityUnit: 'kg',
      packsPerOuter: 5,
    });
    expect(overview.totalPacks).toBe(10);
  });
});
