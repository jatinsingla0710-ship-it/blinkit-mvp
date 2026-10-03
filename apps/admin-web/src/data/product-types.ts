/**
 * Product Management v1 view models.
 * Ready to map from Supabase catalogue / price / inventory tables later.
 */

export type ProductPublishStatus = 'draft' | 'published' | 'archived';

export type ProductReadinessLabel =
  | 'Draft'
  | 'Inactive'
  | 'Missing SKU'
  | 'Missing Price'
  | 'Ready to Publish'
  | 'Active'
  | 'Archived';

export type InventoryReadinessStatus =
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'not_tracked';

export type SellingUnitVm = string;

export type PublishChecklistKey =
  | 'category'
  | 'image'
  | 'sku'
  | 'current_price'
  | 'moq'
  | 'selling_unit'
  | 'inventory';

export interface PublishChecklistItem {
  key: PublishChecklistKey;
  label: string;
  ready: boolean;
  detail: string;
  /** Recommended only — does not block publish / customer catalogue visibility. */
  optional?: boolean;
}

export interface ProductListRow {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  skuCount: number;
  /** Primary SKU code for list display. */
  primarySkuCode?: string;
  primarySkuName?: string;
  packagingLabel?: string;
  availablePacks?: number;
  availableStockLabel?: string;
  imageUrl?: string;
  /** Primary SKU trade price label, or "—" when pricing not ready. */
  currentTradePriceLabel: string;
  inventoryStatus: InventoryReadinessStatus;
  publishStatus: ProductPublishStatus;
  /** Human-readable setup state for the product list. */
  readinessLabel: ProductReadinessLabel;
  updatedAtLabel: string;
}

export interface ProductSkuRow {
  id: string;
  skuCode: string;
  name: string;
  grade?: string;
  specification?: string;
  sellingUnit: SellingUnitVm;
  netQuantity?: number;
  netQuantityUnit?: string;
  moq: number;
  quantityStep: number;
  packsPerCarton?: number;
  outerType?: string;
  packDiscountType?: 'none' | 'percent' | 'fixed';
  packDiscountValue?: number;
  containerPriceMode?: 'calculated' | 'custom';
  containerCustomPrice?: number | null;
  containerDiscountType?: 'none' | 'percent' | 'fixed';
  containerDiscountValue?: number;
  /** HSN for GST. */
  hsnCode?: string | null;
  /** GST rate percent. */
  gstRatePercent?: number | null;
  currentTradePrice?: number;
  currentTradePriceLabel: string;
  inventoryStatus: InventoryReadinessStatus;
  availableLabel: string;
  isActive: boolean;
}

export interface PriceTierRow {
  id: string;
  minQuantity: number;
  unitPrice: number;
  unitPriceLabel: string;
  savingsLabel?: string;
}

export interface OuterDiscountTierRow {
  id: string;
  minOuterQuantity: number;
  discountPerOuterUnit: number;
  discountLabel: string;
}

export interface PriceHistoryRow {
  id: string;
  skuCode: string;
  tradePriceLabel: string;
  effectiveFromLabel: string;
  effectiveToLabel?: string;
  changedByLabel: string;
}

export interface InventoryMovementRow {
  id: string;
  skuCode: string;
  typeLabel: string;
  quantityLabel: string;
  locationLabel: string;
  atLabel: string;
  note?: string;
  /** Raw movement type for timeline icons. */
  movementType?: string;
  quantityDelta?: number;
}

export interface ProductWarehouseStockRow {
  balanceId: string;
  locationId: string;
  locationName: string;
  skuCode: string;
  availablePacks: number;
  reservedPacks: number;
  onHandPacks: number;
  availableLabel: string;
  reservedLabel: string;
  onHandLabel: string;
  /** Human mixed summary e.g. "8 Bags + 2 Packs". */
  mixedSummary: string;
  inventoryStatus: InventoryReadinessStatus;
}

export interface ProductInventoryOverview {
  totalAvailablePacks: number;
  totalAvailableLabel: string;
  status: InventoryReadinessStatus;
  statusLabel: string;
  statusTone: 'positive' | 'warning' | 'danger' | 'muted';
  equivalents: Array<{ icon: string; label: string; detail?: string }>;
  mixedSummary?: string;
}

export interface ProductImageRow {
  id: string;
  /** Public Storage / CDN URL for preview. */
  url: string;
  urlLabel: string;
  isPrimary: boolean;
  altLabel: string;
  mediaKind: 'IMAGE' | 'VIDEO';
  displayOrder: number;
}

export type ProductTypeVm = 'PACKED' | 'BULK';

export interface ProductDetail {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
  categoryName: string;
  productType: ProductTypeVm;
  /** Catalogue active flag (distinct from derived publishStatus). */
  isActive: boolean;
  publishStatus: ProductPublishStatus;
  inventoryStatus: InventoryReadinessStatus;
  skuCount: number;
  currentTradePriceLabel: string;
  updatedAtLabel: string;
  createdAtLabel: string;
  hasImage: boolean;
  primaryImageUrl?: string;
  inventoryOverview?: ProductInventoryOverview;
  warehouseStock: ProductWarehouseStockRow[];
  skus: ProductSkuRow[];
  priceHistory: PriceHistoryRow[];
  inventoryMovements: InventoryMovementRow[];
  images: ProductImageRow[];
  priceTiers: PriceTierRow[];
  outerDiscountTiers: OuterDiscountTierRow[];
  checklist: PublishChecklistItem[];
  canPublish: boolean;
}

export interface ProductDeletionInfo {
  orderLineCount: number;
  movementCount: number;
  hasStock: boolean;
  canPermanentlyDelete: boolean;
}
