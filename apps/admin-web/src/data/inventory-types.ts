/**
 * Inventory Management view models.
 * Append-only stock movement ledger — never overwrite history.
 * Balances remain per SKU × operational location (warehouse).
 */

export type InventoryHealthStatus =
  | 'healthy'
  | 'low'
  | 'out_of_stock'
  | 'incoming';

export type StockMovementType =
  | 'supplier_receipt'
  | 'customer_order'
  | 'damage'
  | 'manual_adjustment'
  | 'return';

export interface InventoryDashboardKpi {
  id: string;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'positive' | 'warning' | 'danger';
}

/** Compact warehouse chip on the inventory list (aggregated SKU row). */
export interface InventoryListWarehouseChip {
  balanceId: string;
  warehouseId: string;
  warehouseName: string;
  mixedStockLabel: string;
  status: InventoryHealthStatus;
}

/**
 * One inventory list row = one SKU aggregated across warehouses.
 * Per-warehouse balances remain available via `warehouses` and detail page.
 */
export interface InventoryListRow {
  /** Prefer skuId for product-centric list uniqueness. */
  id: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  productId: string;
  productName: string;
  categoryName: string;
  imageUrl?: string;
  /** Primary / default warehouse (first balance) — kept for fixtures & deep links. */
  warehouseId: string;
  warehouseName: string;
  /** Human primary stock: e.g. "5 Bags + 5 Packs". */
  mixedStockLabel: string;
  /** Secondary: e.g. "55 Packs total". */
  packsTotalLabel: string;
  weightTotalLabel?: string;
  /** Packaging hint: e.g. "5 kg · 10 Packs per Bag". */
  packagingLabel: string;
  availablePacks: number;
  availableLabel: string;
  reservedLabel: string;
  incomingLabel: string;
  reorderLevelLabel: string;
  status: InventoryHealthStatus;
  unitLabel: string;
  warehouseCount: number;
  warehouses: InventoryListWarehouseChip[];
  /** Sum of warehouse stock_value (WAC). */
  stockValue: number;
  stockValueLabel: string;
  /** True when any warehouse balance has quantity but no average cost. */
  valuationIncomplete: boolean;
  /** Blended WAC across warehouses when cost is complete. */
  averageUnitCost: number | null;
  averageUnitCostLabel: string;
}

/** One warehouse stock position for a SKU (inventory_balances row). */
export interface InventoryWarehouseBalance {
  balanceId: string;
  warehouseId: string;
  warehouseName: string;
  /** false when location is inactive or soft-deleted */
  warehouseActive: boolean;
  onHandLabel: string;
  reservedLabel: string;
  availableLabel: string;
  /** Human mixed labels (Bags + Packs). */
  mixedAvailableLabel: string;
  mixedOnHandLabel: string;
  mixedReservedLabel: string;
  packsTotalLabel: string;
  availablePacks: number;
  reservedPacks: number;
  onHandQuantity: number;
  status: InventoryHealthStatus;
  updatedAtLabel: string;
  averageUnitCost: number | null;
  averageUnitCostLabel: string;
  stockValue: number;
  stockValueLabel: string;
  valuationIncomplete: boolean;
}

export interface StockMovementRow {
  id: string;
  type: StockMovementType;
  typeLabel: string;
  quantityLabel: string;
  warehouseName: string;
  referenceLabel?: string;
  note?: string;
  atLabel: string;
  recordedByLabel: string;
  unitCostLabel?: string;
}

export interface StockReservationRow {
  id: string;
  orderCode: string;
  shopName: string;
  quantityLabel: string;
  statusLabel: string;
  reservedAtLabel: string;
  expiresAtLabel?: string;
}

export interface StockAdjustmentRow {
  id: string;
  reasonLabel: string;
  quantityLabel: string;
  warehouseName: string;
  atLabel: string;
  recordedByLabel: string;
  note?: string;
}

export interface InventorySkuDetail {
  skuId: string;
  skuCode: string;
  skuName: string;
  productId: string;
  productName: string;
  categoryName: string;
  imageUrl?: string;
  /** Company-wide totals across all warehouses for this SKU. */
  totalAvailablePacks: number;
  totalMixedStockLabel: string;
  totalPacksLabel: string;
  totalWeightLabel?: string;
  overallStatus: InventoryHealthStatus;
  packagingLabel: string;
  /** All warehouse balances for this SKU (never an arbitrary single row). */
  warehouses: InventoryWarehouseBalance[];
  /** Selected inventory_balances.id */
  balanceId: string;
  warehouseId: string;
  warehouseName: string;
  /** Selected warehouse is active and not soft-deleted */
  warehouseActive: boolean;
  unitLabel: string;
  onHandLabel: string;
  availableLabel: string;
  reservedLabel: string;
  incomingLabel: string;
  reorderLevelLabel: string;
  /** Numeric on-hand for adjustments (selected warehouse) */
  onHandQuantity?: number;
  /** Pack size for warehouse-friendly summaries (skus.net_quantity). */
  netQuantity?: number;
  netQuantityUnit?: string;
  /** Outer packaging count (skus.packs_per_carton). */
  packsPerCarton?: number;
  /** Outer packaging type (bag/box/carton…). */
  outerType?: string;
  averageUnitCost: number | null;
  averageUnitCostLabel: string;
  stockValue: number;
  stockValueLabel: string;
  /** Sum of stock_value across warehouses for this SKU. */
  totalStockValue: number;
  totalStockValueLabel: string;
  valuationMethodLabel: string;
  valuationNote: string | null;
  valuationIncomplete: boolean;
  status: InventoryHealthStatus;
  updatedAtLabel: string;
  /** Movements for selected SKU + warehouse only */
  movements: StockMovementRow[];
  /** Reservations for selected SKU + warehouse only */
  reservations: StockReservationRow[];
  /** Adjustments for selected SKU + warehouse only */
  adjustments: StockAdjustmentRow[];
}

export interface InventorySnapshot {
  generatedAtLabel: string;
  kpis: InventoryDashboardKpi[];
  rows: InventoryListRow[];
}
