/**
 * Admin ERP domain model contracts.
 * View-model shaped (labels ready for UI) — same shapes fixtures used.
 * Strict typing; no `any`.
 */

export interface ProductListItem {
  id: string;
  name: string;
  categoryLabel: string;
  publishStatus: 'draft' | 'published' | 'archived';
  inventoryStatus: string;
  updatedAtLabel: string;
}

export interface ProductDetailModel {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface CategoryListItem {
  id: string;
  name: string;
  slug: string;
  productCount: number;
  status: 'active' | 'inactive';
}

export interface SkuListItem {
  id: string;
  productId: string;
  skuCode: string;
  label: string;
  packSizeLabel: string;
}

export interface PriceListItem {
  id: string;
  skuCode: string;
  productName: string;
  currentPriceLabel: string;
  status: string;
  updatedAtLabel: string;
}

export interface InventoryListItem {
  id: string;
  skuCode: string;
  productName: string;
  availableLabel: string;
  reservedLabel: string;
  status: string;
}

export interface CustomerListItem {
  id: string;
  shopName: string;
  ownerName: string;
  areaLabel: string;
  status: string;
  updatedAtLabel: string;
}

export interface OrderListItem {
  id: string;
  orderCode: string;
  customerName: string;
  amountLabel: string;
  status: string;
  updatedAtLabel: string;
}

export interface SalesmanListItem {
  id: string;
  name: string;
  territory: string;
  status: string;
  updatedAtLabel: string;
}

export interface DeliveryRouteListItem {
  id: string;
  routeCode: string;
  driverName: string;
  status: string;
  updatedAtLabel: string;
}

/** Opaque snapshot bags — admin UI owns detailed shapes via app types. */
export type SnapshotBag = Record<string, unknown>;
