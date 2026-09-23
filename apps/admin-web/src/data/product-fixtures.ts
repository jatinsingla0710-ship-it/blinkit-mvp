import type {
  ProductDetail,
  ProductListRow,
} from './product-types';
import { buildPublishChecklist, isPublishReady } from './publish';
import { buildInventoryOverview } from './product-inventory-display';

const DEFAULT_OVERVIEW = buildInventoryOverview({ availablePacks: 0 });

/**
 * Layout fixtures only — replace with Supabase catalogue queries.
 * Not business truth.
 */
export const PRODUCT_LIST_FIXTURE: ProductListRow[] = [
  {
    id: 'prod-akhrot',
    name: 'Akhrot Giri',
    categoryId: 'cat-luxury',
    categoryName: 'Luxury',
    skuCount: 2,
    primarySkuCode: 'AKH-LA-10',
    primarySkuName: 'Akhrot Giri · Light Amber',
    packagingLabel: 'Akhrot Giri · Light Amber\n10 kg',
    availablePacks: 12,
    availableStockLabel: '12 kg available',
    currentTradePriceLabel: '₹920 / KG',
    inventoryStatus: 'low_stock',
    publishStatus: 'published',
    readinessLabel: 'Active',
    updatedAtLabel: '16 Jul 2026, 09:12',
  },
  {
    id: 'prod-kishmish',
    name: 'Kishmish Green',
    categoryId: 'cat-raisins',
    categoryName: 'Raisins',
    skuCount: 1,
    currentTradePriceLabel: '₹210 / Carton',
    inventoryStatus: 'in_stock',
    publishStatus: 'published',
    readinessLabel: 'Active',
    updatedAtLabel: '15 Jul 2026, 18:40',
  },
  {
    id: 'prod-chilli',
    name: 'Kashmiri Chilli',
    categoryId: 'cat-spices',
    categoryName: 'Spices',
    skuCount: 1,
    currentTradePriceLabel: '₹280 / Pack',
    inventoryStatus: 'in_stock',
    publishStatus: 'draft',
    readinessLabel: 'Ready to Publish',
    updatedAtLabel: '16 Jul 2026, 08:05',
  },
  {
    id: 'prod-festival',
    name: 'Festival Assortment',
    categoryId: 'cat-mixes',
    categoryName: 'Mixes',
    skuCount: 0,
    currentTradePriceLabel: '—',
    inventoryStatus: 'not_tracked',
    publishStatus: 'draft',
    readinessLabel: 'Missing SKU',
    updatedAtLabel: '14 Jul 2026, 11:22',
  },
  {
    id: 'prod-legacy-mix',
    name: 'Legacy Gift Mix',
    categoryId: 'cat-mixes',
    categoryName: 'Mixes',
    skuCount: 1,
    currentTradePriceLabel: '₹1,450 / Carton',
    inventoryStatus: 'out_of_stock',
    publishStatus: 'archived',
    readinessLabel: 'Archived',
    updatedAtLabel: '01 Jun 2026, 16:00',
  },
];

function detailFor(
  row: ProductListRow,
  overrides: Partial<ProductDetail> &
    Pick<
      ProductDetail,
      | 'description'
      | 'categoryId'
      | 'hasImage'
      | 'skus'
      | 'priceHistory'
      | 'inventoryMovements'
      | 'images'
      | 'createdAtLabel'
    >,
): ProductDetail {
  const checklist = buildPublishChecklist({
    hasCategory: Boolean(row.categoryName),
    hasImage: overrides.hasImage,
    hasSku: overrides.skus.some((s) => s.isActive),
    hasCurrentPrice: overrides.skus.some(
      (s) => s.isActive && s.currentTradePriceLabel !== '—',
    ),
    hasMoq: overrides.skus.some((s) => s.isActive && s.moq > 0),
    hasSellingUnit: overrides.skus.some((s) => s.isActive),
    hasInventory: row.inventoryStatus !== 'not_tracked',
  });
  const canPublish = isPublishReady(checklist) && row.publishStatus !== 'archived';

  return {
    id: row.id,
    name: row.name,
    categoryName: row.categoryName,
    productType: 'PACKED',
    isActive: row.publishStatus === 'published',
    publishStatus: row.publishStatus,
    inventoryStatus: row.inventoryStatus,
    skuCount: row.skuCount,
    currentTradePriceLabel: row.currentTradePriceLabel,
    updatedAtLabel: row.updatedAtLabel,
    checklist,
    canPublish,
    warehouseStock: [],
    inventoryOverview: DEFAULT_OVERVIEW,
    primaryImageUrl: overrides.images?.find((img) => img.isPrimary)?.url,
    priceTiers: [],
    outerDiscountTiers: [],
    ...overrides,
  };
}

export const PRODUCT_DETAIL_FIXTURES: Record<string, ProductDetail> = {
  'prod-akhrot': detailFor(PRODUCT_LIST_FIXTURE[0], {
    categoryId: 'cat-luxury',
    description: 'Premium Kashmiri walnut kernels for wholesale trade.',
    createdAtLabel: '02 May 2026, 10:00',
    hasImage: true,
    skus: [
      {
        id: 'sku-akh-10',
        skuCode: 'AKH-LA-10',
        name: 'Akhrot Giri · Light Amber',
        grade: 'Light Amber',
        sellingUnit: 'KG',
        moq: 10,
        quantityStep: 10,
        currentTradePriceLabel: '₹920 / KG',
        inventoryStatus: 'low_stock',
        availableLabel: '12 KG',
        isActive: true,
      },
      {
        id: 'sku-akh-ctn',
        skuCode: 'AKH-LA-CTN',
        name: 'Akhrot Giri · Carton',
        grade: 'Light Amber',
        sellingUnit: 'CARTON',
        moq: 1,
        quantityStep: 1,
        packsPerCarton: 10,
        currentTradePriceLabel: '₹8,900 / Carton',
        inventoryStatus: 'in_stock',
        availableLabel: '18 Carton',
        isActive: true,
      },
    ],
    priceHistory: [
      {
        id: 'ph-1',
        skuCode: 'AKH-LA-10',
        tradePriceLabel: '₹920',
        effectiveFromLabel: '10 Jul 2026',
        changedByLabel: 'Owner',
      },
      {
        id: 'ph-2',
        skuCode: 'AKH-LA-10',
        tradePriceLabel: '₹905',
        effectiveFromLabel: '01 Jun 2026',
        effectiveToLabel: '09 Jul 2026',
        changedByLabel: 'Owner',
      },
    ],
    inventoryMovements: [
      {
        id: 'im-1',
        skuCode: 'AKH-LA-10',
        typeLabel: 'Sale',
        quantityLabel: '-20 KG',
        locationLabel: 'Hub — CP',
        atLabel: '15 Jul 2026, 17:10',
        note: 'Route GA-14',
      },
      {
        id: 'im-2',
        skuCode: 'AKH-LA-10',
        typeLabel: 'Receipt',
        quantityLabel: '+50 KG',
        locationLabel: 'Hub — CP',
        atLabel: '12 Jul 2026, 09:00',
      },
    ],
    images: [
      {
        id: 'img-1',
        url: 'https://cdn.groaurum.local/akhrot-primary.jpg',
        urlLabel: 'akhrot-primary.jpg',
        isPrimary: true,
        altLabel: 'Akhrot Giri primary',
        mediaKind: 'IMAGE' as const,
        displayOrder: 0,
      },
    ],
  }),
  'prod-kishmish': detailFor(PRODUCT_LIST_FIXTURE[1], {
    categoryId: 'cat-raisins',
    description: 'Afghan green raisins, wholesale carton.',
    createdAtLabel: '18 Apr 2026, 12:30',
    hasImage: true,
    skus: [
      {
        id: 'sku-kis',
        skuCode: 'KIS-EL-CTN',
        name: 'Kishmish Green · Extra Long',
        grade: 'Extra Long',
        sellingUnit: 'CARTON',
        moq: 1,
        quantityStep: 1,
        packsPerCarton: 24,
        currentTradePriceLabel: '₹210 / Carton',
        inventoryStatus: 'in_stock',
        availableLabel: '120 Carton',
        isActive: true,
      },
    ],
    priceHistory: [
      {
        id: 'ph-k1',
        skuCode: 'KIS-EL-CTN',
        tradePriceLabel: '₹210',
        effectiveFromLabel: '01 Jul 2026',
        changedByLabel: 'Owner',
      },
    ],
    inventoryMovements: [
      {
        id: 'im-k1',
        skuCode: 'KIS-EL-CTN',
        typeLabel: 'Adjustment',
        quantityLabel: '+12 Carton',
        locationLabel: 'Hub — Saket',
        atLabel: '08 Jul 2026, 14:22',
      },
    ],
    images: [
      {
        id: 'img-k1',
        url: 'https://cdn.groaurum.local/kishmish-green.jpg',
        urlLabel: 'kishmish-green.jpg',
        isPrimary: true,
        altLabel: 'Kishmish Green',
        mediaKind: 'IMAGE' as const,
        displayOrder: 0,
      },
    ],
  }),
  'prod-chilli': detailFor(PRODUCT_LIST_FIXTURE[2], {
    categoryId: 'cat-spices',
    description: 'Deep-red Kashmiri chilli powder — draft, pending publish checks.',
    createdAtLabel: '16 Jul 2026, 07:50',
    hasImage: false,
    skus: [
      {
        id: 'sku-chilli',
        skuCode: 'SPC-KC-1KG',
        name: 'Kashmiri Chilli · 1 KG pack',
        grade: 'A',
        sellingUnit: 'PACK',
        moq: 10,
        quantityStep: 10,
        packsPerCarton: 10,
        currentTradePriceLabel: '₹280 / Pack',
        inventoryStatus: 'in_stock',
        availableLabel: '160 Pack',
        isActive: true,
      },
    ],
    priceHistory: [
      {
        id: 'ph-c1',
        skuCode: 'SPC-KC-1KG',
        tradePriceLabel: '₹280',
        effectiveFromLabel: '16 Jul 2026',
        changedByLabel: 'Owner',
      },
    ],
    inventoryMovements: [
      {
        id: 'im-c1',
        skuCode: 'SPC-KC-1KG',
        typeLabel: 'Receipt',
        quantityLabel: '+160 Pack',
        locationLabel: 'Hub — CP',
        atLabel: '16 Jul 2026, 08:00',
      },
    ],
    images: [],
  }),
  'prod-festival': detailFor(PRODUCT_LIST_FIXTURE[3], {
    categoryId: 'cat-mixes',
    description: 'Draft assortment shell — SKUs and pricing incomplete.',
    createdAtLabel: '14 Jul 2026, 11:00',
    hasImage: false,
    skus: [],
    priceHistory: [],
    inventoryMovements: [],
    images: [],
  }),
  'prod-legacy-mix': detailFor(PRODUCT_LIST_FIXTURE[4], {
    categoryId: 'cat-mixes',
    description: 'Archived gift mix — retained for history only.',
    createdAtLabel: '10 Jan 2025, 09:00',
    hasImage: true,
    skus: [
      {
        id: 'sku-legacy',
        skuCode: 'MIX-LEG-CTN',
        name: 'Legacy Gift Mix',
        sellingUnit: 'CARTON',
        moq: 1,
        quantityStep: 1,
        packsPerCarton: 8,
        currentTradePriceLabel: '₹1,450 / Carton',
        inventoryStatus: 'out_of_stock',
        availableLabel: '0 Carton',
        isActive: false,
      },
    ],
    priceHistory: [
      {
        id: 'ph-l1',
        skuCode: 'MIX-LEG-CTN',
        tradePriceLabel: '₹1,450',
        effectiveFromLabel: '01 Jan 2026',
        changedByLabel: 'Owner',
      },
    ],
    inventoryMovements: [],
    images: [
      {
        id: 'img-l1',
        url: 'https://cdn.groaurum.local/legacy-mix.jpg',
        urlLabel: 'legacy-mix.jpg',
        isPrimary: true,
        altLabel: 'Legacy Gift Mix',
        mediaKind: 'IMAGE' as const,
        displayOrder: 0,
      },
    ],
  }),
};

export function getProductDetailFixture(productId: string): ProductDetail | null {
  return PRODUCT_DETAIL_FIXTURES[productId] ?? null;
}
