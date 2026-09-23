import type { WarehouseListItem } from '@/data/warehouse-model';
import type { WarehouseRow } from '@/data/settings-types';

type DbOperationalLocationRow = Record<string, unknown>;

function str(v: unknown): string {
  if (v == null) return '';
  return String(v);
}

/** Map a PostgREST operational_locations row to the admin list view-model. */
export function mapDbRowToWarehouseListItem(
  row: DbOperationalLocationRow,
): WarehouseListItem {
  return {
    id: str(row['id']),
    name: str(row['name']),
    city: str(row['city']),
    state: str(row['state']),
    pinCode: str(row['pin_code']),
    addressLine: str(row['address_line']),
    status: row['is_active'] === false ? 'inactive' : 'active',
  };
}

/** Map list view-model rows into Settings snapshot warehouse rows. */
export function mapWarehouseListItemToSettingsRow(
  row: WarehouseListItem,
): WarehouseRow {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    state: row.state,
    pinCode: row.pinCode,
    addressLine: row.addressLine,
    status: row.status === 'active' ? 'active' : 'disabled',
  };
}
