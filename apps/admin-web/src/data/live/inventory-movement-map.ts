import type { StockMovementType, StockMovementRow } from '../inventory-types';
import type { InventoryMovementRow } from '../product-types';
import { formatDateTime } from './format';
import { formatWacUnitCost } from '../inventory-valuation';

type MovementRow = Record<string, unknown>;

const DB_MOVEMENT_TYPE_TO_UI: Record<string, StockMovementType> = {
  ADMIN_ADJUSTMENT: 'manual_adjustment',
  RECEIPT: 'supplier_receipt',
  ORDER_DISPATCH: 'customer_order',
  DAMAGE: 'damage',
  RETURN: 'return',
};

const UI_MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  supplier_receipt: 'Supplier Receipt',
  customer_order: 'Customer Order',
  damage: 'Damage',
  manual_adjustment: 'Manual Adjustment',
  return: 'Return',
};

/** Legacy/wrong column names that must not be read from inventory_movements rows. */
export const INVALID_INVENTORY_MOVEMENT_COLUMNS = [
  'quantity_change',
  'warehouse_id',
  'notes',
  'recorded_by',
  'created_by',
] as const;

export function mapDbMovementType(dbType: unknown): StockMovementType {
  const key = String(dbType ?? '').trim().toUpperCase();
  return DB_MOVEMENT_TYPE_TO_UI[key] ?? 'manual_adjustment';
}

export function movementTypeLabel(uiType: StockMovementType): string {
  return UI_MOVEMENT_TYPE_LABELS[uiType];
}

export function formatMovementQuantityLabel(quantityDelta: unknown): string {
  const n = Number(quantityDelta);
  const value = Number.isFinite(n) ? n : 0;
  return `${value >= 0 ? '+' : ''}${value}`;
}

export function isAdjustmentMovementType(type: StockMovementType): boolean {
  return type === 'manual_adjustment' || type === 'damage';
}

function movementNote(row: MovementRow): string | undefined {
  const reason = row['reason'];
  if (reason == null || String(reason).trim() === '') return undefined;
  return String(reason);
}

function warehouseName(
  row: MovementRow,
  locMap: ReadonlyMap<string, string>,
): string {
  const locationId = String(row['operational_location_id'] ?? '');
  return locMap.get(locationId) ?? '—';
}

function recordedByLabel(
  row: MovementRow,
  profileMap: ReadonlyMap<string, string>,
): string {
  const actorId = String(row['actor_profile_id'] ?? '');
  return profileMap.get(actorId) ?? '—';
}

export function mapStockMovementRow(
  row: MovementRow,
  locMap: ReadonlyMap<string, string>,
  profileMap: ReadonlyMap<string, string>,
): StockMovementRow {
  const uiType = mapDbMovementType(row['movement_type']);

  return {
    id: String(row['id'] ?? ''),
    type: uiType,
    typeLabel: movementTypeLabel(uiType),
    quantityLabel: formatMovementQuantityLabel(row['quantity_delta']),
    warehouseName: warehouseName(row, locMap),
    referenceLabel: row['reference_id']
      ? String(row['reference_id'])
      : undefined,
    note: movementNote(row),
    atLabel: formatDateTime(String(row['created_at'] ?? '')),
    recordedByLabel: recordedByLabel(row, profileMap),
    unitCostLabel:
      row['unit_cost'] == null || row['unit_cost'] === ''
        ? undefined
        : formatWacUnitCost(Number(row['unit_cost'])),
  };
}

const PRODUCT_MOVEMENT_LABELS: Record<string, string> = {
  RECEIPT: 'Stock Received',
  ORDER_DISPATCH: 'Stock Deducted',
  RETURN: 'Stock Returned',
  DAMAGE: 'Stock Damaged',
  ADMIN_ADJUSTMENT: 'Manual Adjustment',
};

export function mapProductInventoryMovementRow(
  row: MovementRow,
  skuCodeById: ReadonlyMap<string, string>,
  locMap: ReadonlyMap<string, string>,
): InventoryMovementRow {
  const skuId = String(row['sku_id'] ?? '');
  const dbType = String(row['movement_type'] ?? '').trim().toUpperCase();
  const uiType = mapDbMovementType(row['movement_type']);

  return {
    id: String(row['id'] ?? ''),
    skuCode: skuCodeById.get(skuId) ?? '—',
    typeLabel: PRODUCT_MOVEMENT_LABELS[dbType] ?? movementTypeLabel(uiType),
    quantityLabel: formatMovementQuantityLabel(row['quantity_delta']),
    locationLabel: warehouseName(row, locMap),
    atLabel: formatDateTime(String(row['created_at'] ?? '')),
    note: movementNote(row),
    movementType: dbType,
    quantityDelta: Number(row['quantity_delta']),
  };
}
