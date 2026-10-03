/**
 * Phase 18 — Purchase recommendations.
 * Rules-based from stock + recent sales + open draft purchases.
 * Honest: not AI demand forecasting; never creates a purchase automatically.
 */

import { formatDate } from '@/data/live/format';
import type { InventoryHealthStatus, InventoryListRow } from '@/data/inventory-types';

/** Same threshold LiveAdminApi uses for inventory "low" status. */
export const LOW_STOCK_THRESHOLD_PACKS = 10;

/** Sales lookback window for velocity (calendar days). */
export const SALES_LOOKBACK_DAYS = 28;

/** Target cover after safety stock (weeks of average sales). */
export const COVER_WEEKS = 2;

/** Safety stock as weeks of average sales. */
export const SAFETY_WEEKS = 0.75;

/** Fallback restock when out of stock with no sales history. */
export const FALLBACK_RESTOCK_PACKS = 20;

const HONESTY_NOTE =
  'Rules-based from stock + last 28 days sales — not AI demand forecasting. Nothing is purchased until you confirm.';

export type PurchaseSkuSignal = {
  skuId: string;
  productName: string;
  skuCode: string;
  skuName: string;
  unitLabel: string;
  availablePacks: number;
  availableLabel: string;
  status: InventoryHealthStatus;
  /** Units sold in the lookback window (packs / selling units as recorded). */
  soldLast28Days: number;
  /** Quantity already on DRAFT purchases for this SKU. */
  openDraftQty: number;
  lastSupplierId: string | null;
  lastSupplierName: string | null;
  /** Quantity on the most recent RECEIVED purchase line for this SKU. */
  lastPurchaseQty: number | null;
};

export type PurchaseRecommendationRow = {
  skuId: string;
  productName: string;
  skuCode: string;
  skuName: string;
  unitLabel: string;
  status: InventoryHealthStatus;
  statusLabel: string;
  currentStock: number;
  currentStockLabel: string;
  weeklyVelocity: number;
  weeklyVelocityLabel: string;
  safetyStock: number;
  targetStock: number;
  openDraftQty: number;
  openDraftLabel: string;
  recommendedQty: number;
  recommendedQtyLabel: string;
  reason: string;
  explainLines: string[];
  priority: number;
  inventoryHref: string;
  purchaseHref: string;
  supplierName: string | null;
};

export type PurchaseRecommendationsSnapshot = {
  generatedAtLabel: string;
  lookbackDays: number;
  honestyNote: string;
  recommendationCount: number;
  outOfStockCount: number;
  lowStockCount: number;
  rows: PurchaseRecommendationRow[];
};

function roundQty(value: number): number {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

function ceilQty(value: number): number {
  return Math.ceil(Math.max(0, Number(value) || 0));
}

function qtyLabel(qty: number, unitLabel: string): string {
  const n = roundQty(qty);
  const text =
    Number.isInteger(n) || Math.abs(n - Math.round(n)) < 1e-9
      ? String(Math.round(n))
      : n.toFixed(3).replace(/\.?0+$/, '');
  const unit = unitLabel.trim() || 'units';
  return `${text} ${unit}`;
}

function statusLabel(status: InventoryHealthStatus): string {
  switch (status) {
    case 'out_of_stock':
      return 'Out of stock';
    case 'low':
      return 'Low stock';
    case 'incoming':
      return 'Incoming';
    case 'healthy':
      return 'Healthy';
    default:
      return status;
  }
}

export type RecommendPurchaseQtyResult = {
  recommendedQty: number;
  weeklyVelocity: number;
  safetyStock: number;
  targetStock: number;
  reason: string;
  explainLines: string[];
  priority: number;
  include: boolean;
};

/**
 * Core recommendation rules for one SKU.
 * Returns include=false when no purchase is suggested.
 */
export function recommendPurchaseQty(
  signal: Pick<
    PurchaseSkuSignal,
    | 'availablePacks'
    | 'status'
    | 'soldLast28Days'
    | 'openDraftQty'
    | 'lastPurchaseQty'
    | 'unitLabel'
  >,
): RecommendPurchaseQtyResult {
  const available = Math.max(0, roundQty(signal.availablePacks));
  const sold = Math.max(0, roundQty(signal.soldLast28Days));
  const openDraft = Math.max(0, roundQty(signal.openDraftQty));
  const weeklyVelocity = roundQty(sold / 4);
  const unit = signal.unitLabel;

  let safetyStock = 0;
  let targetStock = 0;
  let reason = '';
  const explainLines: string[] = [];

  explainLines.push(`Current stock: ${qtyLabel(available, unit)}`);

  if (weeklyVelocity > 0) {
    safetyStock = ceilQty(weeklyVelocity * SAFETY_WEEKS);
    targetStock = ceilQty(weeklyVelocity * COVER_WEEKS + safetyStock);
    explainLines.push(
      `Average weekly sales (last ${SALES_LOOKBACK_DAYS} days): ${qtyLabel(weeklyVelocity, unit)}`,
    );
    explainLines.push(
      `Recommended safety stock (~${SAFETY_WEEKS} week): ${qtyLabel(safetyStock, unit)}`,
    );
    explainLines.push(
      `Target cover (~${COVER_WEEKS} weeks + safety): ${qtyLabel(targetStock, unit)}`,
    );
  } else if (signal.status === 'out_of_stock') {
    targetStock = ceilQty(signal.lastPurchaseQty ?? FALLBACK_RESTOCK_PACKS);
    reason = signal.lastPurchaseQty
      ? 'Out of stock — restock to last received purchase quantity'
      : `Out of stock — no recent sales; restock to ${FALLBACK_RESTOCK_PACKS} units`;
    explainLines.push('Average weekly sales: no sales in last 28 days');
    explainLines.push(`Target restock: ${qtyLabel(targetStock, unit)}`);
  } else if (signal.status === 'low') {
    targetStock = LOW_STOCK_THRESHOLD_PACKS * 2;
    reason = `Low stock (under ${LOW_STOCK_THRESHOLD_PACKS}) — no recent sales; top up toward ${targetStock}`;
    explainLines.push('Average weekly sales: no sales in last 28 days');
    explainLines.push(`Target restock: ${qtyLabel(targetStock, unit)}`);
  } else {
    // Healthy and no sales velocity — nothing to recommend.
    return {
      recommendedQty: 0,
      weeklyVelocity: 0,
      safetyStock: 0,
      targetStock: 0,
      reason: '',
      explainLines: [],
      priority: 0,
      include: false,
    };
  }

  explainLines.push(
    `Open draft purchase: ${qtyLabel(openDraft, unit)}`,
  );

  const recommendedQty = ceilQty(targetStock - available - openDraft);

  if (recommendedQty <= 0) {
    return {
      recommendedQty: 0,
      weeklyVelocity,
      safetyStock,
      targetStock,
      reason: 'Already covered by stock and open drafts',
      explainLines,
      priority: 0,
      include: false,
    };
  }

  // Short cover while still "healthy": only suggest if less than ~1 week of sales left.
  if (
    signal.status === 'healthy' &&
    weeklyVelocity > 0 &&
    available >= weeklyVelocity
  ) {
    return {
      recommendedQty: 0,
      weeklyVelocity,
      safetyStock,
      targetStock,
      reason: '',
      explainLines: [],
      priority: 0,
      include: false,
    };
  }

  if (!reason) {
    if (signal.status === 'out_of_stock') {
      reason = 'Out of stock — reorder for ~2 weeks cover + safety';
    } else if (signal.status === 'low') {
      reason = 'Low stock — reorder for ~2 weeks cover + safety';
    } else {
      reason = 'Under 1 week of sales cover — reorder for ~2 weeks + safety';
    }
  }

  explainLines.push(`Recommendation: ${qtyLabel(recommendedQty, unit)}`);

  let priority = 0;
  if (signal.status === 'out_of_stock') priority = 300;
  else if (signal.status === 'low') priority = 200;
  else priority = 100;
  priority += weeklyVelocity;
  priority += recommendedQty / 1000;

  return {
    recommendedQty,
    weeklyVelocity,
    safetyStock,
    targetStock,
    reason,
    explainLines,
    priority,
    include: true,
  };
}

export function inventoryRowToSignal(
  row: InventoryListRow,
  extras: {
    soldLast28Days: number;
    openDraftQty: number;
    lastSupplierId: string | null;
    lastSupplierName: string | null;
    lastPurchaseQty: number | null;
  },
): PurchaseSkuSignal {
  return {
    skuId: row.skuId,
    productName: row.productName,
    skuCode: row.skuCode,
    skuName: row.skuName,
    unitLabel: row.unitLabel,
    availablePacks: row.availablePacks,
    availableLabel: row.availableLabel || row.mixedStockLabel,
    status: row.status,
    soldLast28Days: extras.soldLast28Days,
    openDraftQty: extras.openDraftQty,
    lastSupplierId: extras.lastSupplierId,
    lastSupplierName: extras.lastSupplierName,
    lastPurchaseQty: extras.lastPurchaseQty,
  };
}

export function buildPurchaseRecommendationsSnapshot(input: {
  generatedAtIso: string;
  signals: readonly PurchaseSkuSignal[];
}): PurchaseRecommendationsSnapshot {
  const rows: PurchaseRecommendationRow[] = [];

  for (const signal of input.signals) {
    const result = recommendPurchaseQty(signal);
    if (!result.include) continue;

    const purchaseHref = signal.lastSupplierId
      ? `/purchases/new?supplierId=${encodeURIComponent(signal.lastSupplierId)}`
      : '/purchases/new';

    rows.push({
      skuId: signal.skuId,
      productName: signal.productName,
      skuCode: signal.skuCode,
      skuName: signal.skuName,
      unitLabel: signal.unitLabel,
      status: signal.status,
      statusLabel: statusLabel(signal.status),
      currentStock: signal.availablePacks,
      currentStockLabel: signal.availableLabel,
      weeklyVelocity: result.weeklyVelocity,
      weeklyVelocityLabel: qtyLabel(result.weeklyVelocity, signal.unitLabel),
      safetyStock: result.safetyStock,
      targetStock: result.targetStock,
      openDraftQty: signal.openDraftQty,
      openDraftLabel: qtyLabel(signal.openDraftQty, signal.unitLabel),
      recommendedQty: result.recommendedQty,
      recommendedQtyLabel: qtyLabel(result.recommendedQty, signal.unitLabel),
      reason: result.reason,
      explainLines: result.explainLines,
      priority: result.priority,
      inventoryHref: `/inventory/${signal.skuId}`,
      purchaseHref,
      supplierName: signal.lastSupplierName,
    });
  }

  rows.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.productName.localeCompare(b.productName);
  });

  return {
    generatedAtLabel: formatDate(input.generatedAtIso),
    lookbackDays: SALES_LOOKBACK_DAYS,
    honestyNote: HONESTY_NOTE,
    recommendationCount: rows.length,
    outOfStockCount: rows.filter((r) => r.status === 'out_of_stock').length,
    lowStockCount: rows.filter((r) => r.status === 'low').length,
    rows,
  };
}
