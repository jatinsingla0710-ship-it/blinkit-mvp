/**
 * Phase 11 — inventory list filters and stock valuation report (no second ledger).
 */

import { formatWacUnitCost } from '@/data/inventory-valuation';
import { formatInr } from '@/data/live/format';
import type {
  InventoryHealthStatus,
  InventoryListRow,
} from '@/data/inventory-types';

export type InventoryListStatusFilter =
  | 'all'
  | 'low'
  | 'out_of_stock'
  | 'healthy';

export function parseInventoryStatusParam(
  value: string | null | undefined,
): InventoryListStatusFilter {
  if (value === 'low' || value === 'out_of_stock' || value === 'healthy') {
    return value;
  }
  return 'all';
}

export function filterInventoryListRows(
  rows: readonly InventoryListRow[],
  opts: {
    search?: string;
    status?: InventoryListStatusFilter;
    warehouseId?: string;
  },
): InventoryListRow[] {
  const q = (opts.search ?? '').trim().toLowerCase();
  const status = opts.status ?? 'all';
  const warehouseId = opts.warehouseId?.trim() || '';

  return rows.filter((row) => {
    if (status === 'low' && row.status !== 'low') return false;
    if (status === 'out_of_stock' && row.status !== 'out_of_stock') return false;
    if (
      status === 'healthy' &&
      row.status !== 'healthy' &&
      row.status !== 'incoming'
    ) {
      return false;
    }
    if (warehouseId) {
      const inWarehouse = row.warehouses.some(
        (wh) => wh.warehouseId === warehouseId,
      );
      if (!inWarehouse) return false;
    }
    if (!q) return true;
    return (
      row.productName.toLowerCase().includes(q) ||
      row.skuName.toLowerCase().includes(q) ||
      row.skuCode.toLowerCase().includes(q) ||
      row.categoryName.toLowerCase().includes(q) ||
      row.warehouses.some((wh) =>
        wh.warehouseName.toLowerCase().includes(q),
      )
    );
  });
}

export function listWarehousesFromInventory(
  rows: readonly InventoryListRow[],
): { id: string; name: string }[] {
  const map = new Map<string, string>();
  for (const row of rows) {
    for (const wh of row.warehouses) {
      if (!wh.warehouseId) continue;
      if (!map.has(wh.warehouseId)) {
        map.set(wh.warehouseId, wh.warehouseName);
      }
    }
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export type StockValuationReportRow = {
  skuId: string;
  productName: string;
  skuCode: string;
  mixedStockLabel: string;
  stockValue: number;
  stockValueLabel: string;
  averageUnitCostLabel: string;
  status: InventoryHealthStatus;
  statusLabel: string;
  valuationIncomplete: boolean;
  detailHref: string;
};

export type StockValuationReport = {
  generatedAtLabel: string;
  totalSkus: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalStockValue: number;
  totalStockValueLabel: string;
  incompleteCostCount: number;
  rows: StockValuationReportRow[];
};

const STATUS_LABEL: Record<InventoryHealthStatus, string> = {
  healthy: 'In stock',
  low: 'Low stock',
  out_of_stock: 'Out of stock',
  incoming: 'Incoming',
};

export function buildStockValuationReport(input: {
  generatedAtLabel: string;
  rows: readonly InventoryListRow[];
}): StockValuationReport {
  const rows: StockValuationReportRow[] = input.rows.map((row) => ({
    skuId: row.skuId,
    productName: row.productName,
    skuCode: row.skuCode,
    mixedStockLabel: row.mixedStockLabel,
    stockValue: row.stockValue,
    stockValueLabel: row.stockValueLabel,
    averageUnitCostLabel: row.averageUnitCostLabel,
    status: row.status,
    statusLabel: STATUS_LABEL[row.status],
    valuationIncomplete: row.valuationIncomplete,
    detailHref: `/inventory/${row.skuId}`,
  }));

  rows.sort(
    (a, b) =>
      b.stockValue - a.stockValue || a.productName.localeCompare(b.productName),
  );

  const totalStockValue = roundMoney(
    rows.reduce((sum, row) => sum + row.stockValue, 0),
  );

  return {
    generatedAtLabel: input.generatedAtLabel,
    totalSkus: rows.length,
    inStockCount: rows.filter(
      (r) => r.status === 'healthy' || r.status === 'incoming',
    ).length,
    lowStockCount: rows.filter((r) => r.status === 'low').length,
    outOfStockCount: rows.filter((r) => r.status === 'out_of_stock').length,
    totalStockValue,
    totalStockValueLabel: totalStockValue > 0 ? formatInr(totalStockValue) : '—',
    incompleteCostCount: rows.filter((r) => r.valuationIncomplete).length,
    rows,
  };
}

export function exportStockValuationCsv(
  rows: readonly StockValuationReportRow[],
): string {
  const header = [
    'Product',
    'SKU',
    'Stock',
    'Avg Unit Cost',
    'Stock Value',
    'Status',
    'Cost Incomplete',
  ];
  const escape = (value: string) =>
    /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const lines = rows.map((r) =>
    [
      escape(r.productName),
      escape(r.skuCode),
      escape(r.mixedStockLabel),
      escape(r.averageUnitCostLabel),
      String(r.stockValue),
      escape(r.statusLabel),
      r.valuationIncomplete ? 'yes' : 'no',
    ].join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

/** Blended WAC across warehouses when valuation is complete. */
export function blendedAverageUnitCost(
  stockValue: number,
  onHandPacks: number,
  valuationIncomplete: boolean,
): { averageUnitCost: number | null; averageUnitCostLabel: string } {
  if (valuationIncomplete || onHandPacks <= 0 || stockValue <= 0) {
    return {
      averageUnitCost: null,
      averageUnitCostLabel: valuationIncomplete
        ? 'Cost incomplete'
        : formatWacUnitCost(null),
    };
  }
  const averageUnitCost =
    Math.round((stockValue / onHandPacks) * 10000) / 10000;
  return {
    averageUnitCost,
    averageUnitCostLabel: formatWacUnitCost(averageUnitCost),
  };
}

export const ADJUST_REASON_PRESETS: Record<
  'add' | 'remove' | 'set',
  readonly { id: string; label: string }[]
> = {
  add: [
    { id: 'opening', label: 'Opening stock / found stock' },
    { id: 'supplier_extra', label: 'Supplier shortfall correction' },
    { id: 'other_add', label: 'Other addition' },
  ],
  remove: [
    { id: 'write_off', label: 'Write-off / damaged' },
    { id: 'expiry', label: 'Expired / unsaleable' },
    { id: 'theft', label: 'Theft / loss' },
    { id: 'other_remove', label: 'Other removal' },
  ],
  set: [
    { id: 'count', label: 'Physical count correction' },
    { id: 'system', label: 'System correction' },
  ],
};
