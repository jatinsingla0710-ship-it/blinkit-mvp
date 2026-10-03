import { describe, expect, it } from 'vitest';
import {
  blendedAverageUnitCost,
  buildStockValuationReport,
  exportStockValuationCsv,
  filterInventoryListRows,
  listWarehousesFromInventory,
  parseInventoryStatusParam,
} from './inventory-ops';
import type { InventoryListRow } from './inventory-types';

function row(
  partial: Partial<InventoryListRow> &
    Pick<InventoryListRow, 'id' | 'skuId' | 'productName' | 'status'>,
): InventoryListRow {
  return {
    skuCode: partial.skuCode ?? 'SKU',
    skuName: partial.skuName ?? 'Variant',
    productId: partial.productId ?? 'p1',
    categoryName: partial.categoryName ?? 'Cat',
    warehouseId: partial.warehouseId ?? 'w1',
    warehouseName: partial.warehouseName ?? 'Main',
    mixedStockLabel: partial.mixedStockLabel ?? '10 Packs',
    packsTotalLabel: partial.packsTotalLabel ?? '10 Packs',
    packagingLabel: partial.packagingLabel ?? 'Pack',
    availablePacks: partial.availablePacks ?? 10,
    availableLabel: partial.availableLabel ?? '10 Packs',
    reservedLabel: partial.reservedLabel ?? '0',
    incomingLabel: '—',
    reorderLevelLabel: '—',
    unitLabel: 'PACK',
    warehouseCount: partial.warehouseCount ?? 1,
    warehouses: partial.warehouses ?? [
      {
        balanceId: 'b1',
        warehouseId: 'w1',
        warehouseName: 'Main',
        mixedStockLabel: '10 Packs',
        status: 'healthy',
      },
    ],
    stockValue: partial.stockValue ?? 100,
    stockValueLabel: partial.stockValueLabel ?? '₹100',
    valuationIncomplete: partial.valuationIncomplete ?? false,
    averageUnitCost: partial.averageUnitCost ?? 10,
    averageUnitCostLabel: partial.averageUnitCostLabel ?? '₹10.00',
    ...partial,
  };
}

describe('Phase 11 inventory ops', () => {
  it('parses status query params', () => {
    expect(parseInventoryStatusParam('low')).toBe('low');
    expect(parseInventoryStatusParam('bogus')).toBe('all');
  });

  it('filters by status, warehouse, and search', () => {
    const rows = [
      row({
        id: '1',
        skuId: 's1',
        productName: 'Atta',
        status: 'low',
        warehouses: [
          {
            balanceId: 'b1',
            warehouseId: 'w1',
            warehouseName: 'Main',
            mixedStockLabel: '5',
            status: 'low',
          },
        ],
      }),
      row({
        id: '2',
        skuId: 's2',
        productName: 'Oil',
        status: 'healthy',
        warehouses: [
          {
            balanceId: 'b2',
            warehouseId: 'w2',
            warehouseName: 'Cold',
            mixedStockLabel: '20',
            status: 'healthy',
          },
        ],
      }),
    ];

    expect(filterInventoryListRows(rows, { status: 'low' })).toHaveLength(1);
    expect(
      filterInventoryListRows(rows, { warehouseId: 'w2' }).map((r) => r.skuId),
    ).toEqual(['s2']);
    expect(filterInventoryListRows(rows, { search: 'oil' })).toHaveLength(1);
    expect(listWarehousesFromInventory(rows)).toEqual([
      { id: 'w2', name: 'Cold' },
      { id: 'w1', name: 'Main' },
    ]);
  });

  it('builds stock valuation report and CSV', () => {
    const report = buildStockValuationReport({
      generatedAtLabel: 'now',
      rows: [
        row({
          id: '1',
          skuId: 's1',
          productName: 'Atta',
          status: 'low',
          stockValue: 500,
          stockValueLabel: '₹500',
          valuationIncomplete: true,
          averageUnitCostLabel: 'Cost incomplete',
        }),
        row({
          id: '2',
          skuId: 's2',
          productName: 'Oil',
          status: 'out_of_stock',
          stockValue: 0,
          availablePacks: 0,
        }),
      ],
    });
    expect(report.totalStockValue).toBe(500);
    expect(report.lowStockCount).toBe(1);
    expect(report.outOfStockCount).toBe(1);
    expect(report.incompleteCostCount).toBe(1);
    expect(exportStockValuationCsv(report.rows)).toContain('Atta');
  });

  it('blends average unit cost from stock value', () => {
    expect(blendedAverageUnitCost(100, 10, false).averageUnitCost).toBe(10);
    expect(blendedAverageUnitCost(100, 10, true).averageUnitCostLabel).toBe(
      'Cost incomplete',
    );
  });
});
