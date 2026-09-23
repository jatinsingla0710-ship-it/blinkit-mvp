import { describe, expect, it } from 'vitest';
import {
  mapDbRowToWarehouseListItem,
  mapWarehouseListItemToSettingsRow,
} from './warehouse-mappers';

describe('warehouse mappers', () => {
  it('maps operational_locations DB columns to list items', () => {
    const mapped = mapDbRowToWarehouseListItem({
      id: 'a3000000-0000-4000-8000-000000000001',
      name: 'GroAurum Warehouse 1',
      city: 'New Delhi',
      state: 'Delhi',
      pin_code: '110074',
      address_line: 'Warehouse Complex, Sector 37',
      is_active: true,
    });
    expect(mapped).toEqual({
      id: 'a3000000-0000-4000-8000-000000000001',
      name: 'GroAurum Warehouse 1',
      city: 'New Delhi',
      state: 'Delhi',
      pinCode: '110074',
      addressLine: 'Warehouse Complex, Sector 37',
      status: 'active',
    });
  });

  it('does not use legacy fake warehouse columns', () => {
    const mapped = mapDbRowToWarehouseListItem({
      id: 'wh-1',
      name: 'Test',
      city: 'Delhi',
      state: 'Delhi',
      pin_code: '110074',
      address_line: 'Sector 37',
      address_line1: 'Ignored',
      pincode: '999999',
      manager_name: 'Ignored',
      code: 'WH-IGNORED',
      is_active: true,
    });
    expect(mapped.pinCode).toBe('110074');
    expect(mapped.addressLine).toBe('Sector 37');
    expect(mapped).not.toHaveProperty('code');
    expect(mapped).not.toHaveProperty('managerName');
    expect(mapped).not.toHaveProperty('addressLabel');
  });

  it('maps inactive warehouses to disabled settings status', () => {
    const settingsRow = mapWarehouseListItemToSettingsRow({
      id: 'wh-2',
      name: 'Buffer',
      city: 'Noida',
      state: 'UP',
      pinCode: '201301',
      addressLine: 'Sector 63',
      status: 'inactive',
    });
    expect(settingsRow.status).toBe('disabled');
    expect(settingsRow.pinCode).toBe('201301');
    expect(settingsRow.addressLine).toBe('Sector 63');
  });
});
