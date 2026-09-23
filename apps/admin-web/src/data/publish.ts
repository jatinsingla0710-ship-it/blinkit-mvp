import type {
  PublishChecklistItem,
  PublishChecklistKey,
} from '@/data/product-types';
import {
  PUBLISH_OPTIONAL_CHECKLIST_KEYS,
  PUBLISH_REQUIRED_CHECKLIST_KEYS,
} from '@/data/product-readiness';

export { isPublishReady } from '@/data/product-readiness';

const CHECKLIST_LABELS: Record<PublishChecklistKey, string> = {
  category: 'Category',
  image: 'Image',
  sku: 'SKU',
  current_price: 'Current Price',
  moq: 'MOQ',
  selling_unit: 'Selling Unit',
  inventory: 'Inventory',
};

const OPTIONAL_KEYS = new Set<PublishChecklistKey>(PUBLISH_OPTIONAL_CHECKLIST_KEYS);

export function buildPublishChecklist(input: {
  hasCategory: boolean;
  hasImage: boolean;
  hasSku: boolean;
  hasCurrentPrice: boolean;
  hasMoq: boolean;
  hasSellingUnit: boolean;
  hasInventory: boolean;
}): PublishChecklistItem[] {
  const flags: Record<PublishChecklistKey, boolean> = {
    category: input.hasCategory,
    image: input.hasImage,
    sku: input.hasSku,
    current_price: input.hasCurrentPrice,
    moq: input.hasMoq,
    selling_unit: input.hasSellingUnit,
    inventory: input.hasInventory,
  };

  const details: Record<PublishChecklistKey, [string, string]> = {
    category: ['Active category assigned', 'Assign an active category'],
    image: [
      'Catalogue image uploaded (optional)',
      'Upload recommended — not required for customer visibility',
    ],
    sku: ['One or more active SKUs', 'Create an orderable SKU'],
    current_price: [
      'Effective trade price on an active SKU',
      'Set initial trade price',
    ],
    moq: ['MOQ configured on SKUs', 'Set minimum order quantity'],
    selling_unit: ['Selling unit configured', 'Set selling unit (KG / Carton / Pack)'],
    inventory: [
      'Stock recorded (optional)',
      'Add stock when ready — customers see OUT OF STOCK without it',
    ],
  };

  return (Object.keys(flags) as PublishChecklistKey[]).map((key) => {
    const ready = flags[key];
    return {
      key,
      label: CHECKLIST_LABELS[key],
      ready,
      detail: ready ? details[key][0] : details[key][1],
      optional: OPTIONAL_KEYS.has(key),
    };
  });
}

export function isRequiredChecklistKey(key: PublishChecklistKey): boolean {
  return (PUBLISH_REQUIRED_CHECKLIST_KEYS as readonly string[]).includes(key);
}
