import { describe, expect, it } from 'vitest';
import {
  INVALID_INVENTORY_MOVEMENT_COLUMNS,
  formatMovementQuantityLabel,
  isAdjustmentMovementType,
  mapDbMovementType,
  mapProductInventoryMovementRow,
  mapStockMovementRow,
} from './inventory-movement-map';

const LOC_MAP = new Map([['loc-1', 'Hub — CP']]);
const PROFILE_MAP = new Map([['actor-1', 'Warehouse Lead']]);
const SKU_CODE_MAP = new Map([['sku-1', 'AKH-LA-10']]);

const BASE_MOVEMENT = {
  id: 'mov-1',
  sku_id: 'sku-1',
  operational_location_id: 'loc-1',
  quantity_delta: 10,
  reason: 'Cycle count correction',
  actor_profile_id: 'actor-1',
  created_at: '2026-07-15T12:00:00.000Z',
};

describe('mapDbMovementType', () => {
  it.each([
    ['ADMIN_ADJUSTMENT', 'manual_adjustment'],
    ['RECEIPT', 'supplier_receipt'],
    ['ORDER_DISPATCH', 'customer_order'],
    ['DAMAGE', 'damage'],
    ['RETURN', 'return'],
  ] as const)('maps %s to %s', (dbType, uiType) => {
    expect(mapDbMovementType(dbType)).toBe(uiType);
  });

  it('falls back to manual_adjustment for unknown DB types', () => {
    expect(mapDbMovementType('UNKNOWN')).toBe('manual_adjustment');
  });
});

describe('formatMovementQuantityLabel', () => {
  it('prefixes positive deltas with +', () => {
    expect(formatMovementQuantityLabel(10)).toBe('+10');
  });

  it('preserves negative deltas without a + prefix', () => {
    expect(formatMovementQuantityLabel(-5)).toBe('-5');
  });
});

describe('mapStockMovementRow', () => {
  it('maps schema columns to inventory detail movement rows', () => {
    const row = mapStockMovementRow(
      { ...BASE_MOVEMENT, movement_type: 'ADMIN_ADJUSTMENT' },
      LOC_MAP,
      PROFILE_MAP,
    );

    expect(row).toMatchObject({
      type: 'manual_adjustment',
      typeLabel: 'Manual Adjustment',
      quantityLabel: '+10',
      warehouseName: 'Hub — CP',
      note: 'Cycle count correction',
      recordedByLabel: 'Warehouse Lead',
    });
  });

  it('includes ADMIN_ADJUSTMENT rows in adjustment movement types', () => {
    const row = mapStockMovementRow(
      { ...BASE_MOVEMENT, movement_type: 'ADMIN_ADJUSTMENT', quantity_delta: -3 },
      LOC_MAP,
      PROFILE_MAP,
    );

    expect(isAdjustmentMovementType(row.type)).toBe(true);
  });

  it('includes DAMAGE rows in adjustment movement types', () => {
    const row = mapStockMovementRow(
      { ...BASE_MOVEMENT, movement_type: 'DAMAGE', quantity_delta: -2 },
      LOC_MAP,
      PROFILE_MAP,
    );

    expect(row.type).toBe('damage');
    expect(isAdjustmentMovementType(row.type)).toBe(true);
  });

  it('does not read legacy inventory_movements column names', () => {
    const legacyRow = {
      ...BASE_MOVEMENT,
      movement_type: 'RECEIPT',
      quantity_change: 999,
      warehouse_id: 'legacy-wh',
      notes: 'legacy note',
      recorded_by: 'legacy-user',
      created_by: 'legacy-user',
    };

    const row = mapStockMovementRow(legacyRow, LOC_MAP, PROFILE_MAP);

    expect(row.quantityLabel).toBe('+10');
    expect(row.warehouseName).toBe('Hub — CP');
    expect(row.note).toBe('Cycle count correction');
    expect(row.recordedByLabel).toBe('Warehouse Lead');
  });
});

describe('mapProductInventoryMovementRow', () => {
  it('maps schema columns for product detail inventory movements', () => {
    const row = mapProductInventoryMovementRow(
      { ...BASE_MOVEMENT, movement_type: 'ORDER_DISPATCH', quantity_delta: -20 },
      SKU_CODE_MAP,
      LOC_MAP,
    );

    expect(row).toMatchObject({
      skuCode: 'AKH-LA-10',
      typeLabel: 'Stock Deducted',
      quantityLabel: '-20',
      locationLabel: 'Hub — CP',
      note: 'Cycle count correction',
    });
  });
});

describe('INVALID_INVENTORY_MOVEMENT_COLUMNS', () => {
  it('lists legacy columns that must not be used for inventory_movements', () => {
    expect(INVALID_INVENTORY_MOVEMENT_COLUMNS).toEqual([
      'quantity_change',
      'warehouse_id',
      'notes',
      'recorded_by',
      'created_by',
    ]);
  });
});
