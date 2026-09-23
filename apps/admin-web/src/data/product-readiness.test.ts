import { describe, expect, it } from 'vitest';
import { buildPublishChecklist, isPublishReady } from './publish';
import {
  computeProductReadinessLabel,
  firstUnpricedActiveSkuId,
  resolveCataloguePublishStatus,
} from './product-readiness';

describe('resolveCataloguePublishStatus', () => {
  it('maps is_active true to published (independent of checklist)', () => {
    expect(resolveCataloguePublishStatus({ isActive: true })).toBe('published');
  });

  it('maps is_active false to draft (not archived)', () => {
    expect(resolveCataloguePublishStatus({ isActive: false })).toBe('draft');
  });

  it('maps soft-deleted to archived', () => {
    expect(
      resolveCataloguePublishStatus({ isActive: false, softDeleted: true }),
    ).toBe('archived');
  });
});

describe('publish button enablement rules', () => {
  const readyChecklist = buildPublishChecklist({
    hasCategory: true,
    hasImage: false,
    hasSku: true,
    hasCurrentPrice: true,
    hasMoq: true,
    hasSellingUnit: true,
    hasInventory: false,
  });

  it('ready draft can publish; inventory is optional', () => {
    expect(isPublishReady(readyChecklist)).toBe(true);
    expect(readyChecklist.find((i) => i.key === 'inventory')?.optional).toBe(
      true,
    );
    const publishStatus = resolveCataloguePublishStatus({ isActive: false });
    expect(publishStatus).toBe('draft');
    // UI: enable Publish when canPublish && draft
    expect(isPublishReady(readyChecklist) && publishStatus === 'draft').toBe(
      true,
    );
  });

  it('draft missing price cannot publish and explains gap', () => {
    const incomplete = buildPublishChecklist({
      hasCategory: true,
      hasImage: false,
      hasSku: true,
      hasCurrentPrice: false,
      hasMoq: true,
      hasSellingUnit: true,
      hasInventory: false,
    });
    expect(isPublishReady(incomplete)).toBe(false);
    const missing = incomplete
      .filter((i) => !i.optional && !i.ready)
      .map((i) => i.label);
    expect(missing).toContain('Current Price');
  });

  it('published product should not show a disabled Publish action', () => {
    const publishStatus = resolveCataloguePublishStatus({ isActive: true });
    expect(publishStatus).toBe('published');
    // UI shows "✓ Published" instead of disabled Publish when published
    const showPublishButton = publishStatus === 'draft';
    expect(showPublishButton).toBe(false);
  });

  it('editing keeps publish state tied to is_active only', () => {
    expect(
      resolveCataloguePublishStatus({ isActive: true }),
    ).toBe('published');
    expect(
      resolveCataloguePublishStatus({ isActive: false }),
    ).toBe('draft');
  });
});

describe('computeProductReadinessLabel', () => {
  it('returns Missing SKU when no active SKU exists', () => {
    expect(
      computeProductReadinessLabel({
        isActive: false,
        publishStatus: 'draft',
        skuCount: 0,
        hasActiveSku: false,
        hasLivePriceOnActiveSku: false,
        canPublish: false,
      }),
    ).toBe('Missing SKU');
  });

  it('returns Missing Price when SKU exists but no live price', () => {
    expect(
      computeProductReadinessLabel({
        isActive: false,
        publishStatus: 'draft',
        skuCount: 1,
        hasActiveSku: true,
        hasLivePriceOnActiveSku: false,
        canPublish: false,
      }),
    ).toBe('Missing Price');
  });

  it('returns Ready to Publish for draft with complete checklist', () => {
    expect(
      computeProductReadinessLabel({
        isActive: false,
        publishStatus: 'draft',
        skuCount: 1,
        hasActiveSku: true,
        hasLivePriceOnActiveSku: true,
        canPublish: true,
      }),
    ).toBe('Ready to Publish');
  });

  it('returns Active when product is already published', () => {
    expect(
      computeProductReadinessLabel({
        isActive: true,
        publishStatus: 'published',
        skuCount: 1,
        hasActiveSku: true,
        hasLivePriceOnActiveSku: true,
        canPublish: true,
      }),
    ).toBe('Active');
  });
});

describe('firstUnpricedActiveSkuId', () => {
  it('returns the first active SKU without a live price label', () => {
    expect(
      firstUnpricedActiveSkuId([
        {
          id: 'sku-priced',
          isActive: true,
          currentTradePriceLabel: '₹100',
        },
        {
          id: 'sku-unpriced',
          isActive: true,
          currentTradePriceLabel: '—',
        },
      ]),
    ).toBe('sku-unpriced');
  });
});
