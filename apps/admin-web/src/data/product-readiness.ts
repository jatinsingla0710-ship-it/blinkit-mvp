import type {
  ProductPublishStatus,
  ProductReadinessLabel,
  PublishChecklistItem,
} from '@/data/product-types';

/**
 * Resolve catalogue publish status from products.is_active.
 * Checklist readiness is separate (canPublish) — do not treat "ready" as already published.
 * Soft-deleted products are filtered out of list/detail; inactive = draft (unpublished).
 */
export function resolveCataloguePublishStatus(input: {
  isActive: boolean;
  softDeleted?: boolean;
}): ProductPublishStatus {
  if (input.softDeleted) return 'archived';
  return input.isActive ? 'published' : 'draft';
}

/** Checklist keys required before a product can be published to the customer catalogue. */
export const PUBLISH_REQUIRED_CHECKLIST_KEYS = [
  'category',
  'sku',
  'current_price',
  'moq',
  'selling_unit',
] as const;

/** Recommended but not required for customer catalogue visibility. */
export const PUBLISH_OPTIONAL_CHECKLIST_KEYS = ['image', 'inventory'] as const;

export function isPublishReady(checklist: PublishChecklistItem[]): boolean {
  return checklist
    .filter((item) => !item.optional)
    .every((item) => item.ready);
}

export function computeProductReadinessLabel(input: {
  isActive: boolean;
  publishStatus: ProductPublishStatus;
  skuCount: number;
  hasActiveSku: boolean;
  hasLivePriceOnActiveSku: boolean;
  canPublish: boolean;
}): ProductReadinessLabel {
  if (input.publishStatus === 'archived') return 'Archived';
  if (input.skuCount === 0 || !input.hasActiveSku) return 'Missing SKU';
  if (!input.hasLivePriceOnActiveSku) return 'Missing Price';
  if (!input.isActive || input.publishStatus === 'draft') {
    return input.canPublish ? 'Ready to Publish' : 'Draft';
  }
  if (input.canPublish) return 'Active';
  return 'Draft';
}

/** First active SKU without a live trade price — used for "Set Price" links. */
export function firstUnpricedActiveSkuId(
  skus: ReadonlyArray<{ id: string; isActive: boolean; currentTradePriceLabel: string }>,
): string | undefined {
  return skus.find(
    (sku) => sku.isActive && sku.currentTradePriceLabel === '—',
  )?.id;
}
