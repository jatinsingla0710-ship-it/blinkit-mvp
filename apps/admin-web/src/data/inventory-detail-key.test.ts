import { describe, expect, it } from 'vitest';
import {
  inventoryDetailLookupKey,
  inventoryDetailPath,
  parseInventoryDetailLookupKey,
  selectInventoryBalance,
} from './inventory-detail-key';

describe('inventory detail lookup key', () => {
  it('encodes and parses sku + balance', () => {
    expect(inventoryDetailLookupKey('sku-1', 'bal-2')).toBe('sku-1::bal-2');
    expect(parseInventoryDetailLookupKey('sku-1::bal-2')).toEqual({
      skuId: 'sku-1',
      balanceId: 'bal-2',
    });
    expect(parseInventoryDetailLookupKey('sku-1')).toEqual({ skuId: 'sku-1' });
  });

  it('builds warehouse-scoped detail paths', () => {
    expect(inventoryDetailPath('sku-1')).toBe('/inventory/sku-1');
    expect(inventoryDetailPath('sku-1', 'bal-2')).toBe(
      '/inventory/sku-1?balance=bal-2',
    );
  });
});

describe('selectInventoryBalance', () => {
  const warehouses = [
    {
      balanceId: 'bal-inactive',
      warehouseActive: false,
    },
    {
      balanceId: 'bal-active',
      warehouseActive: true,
    },
  ];

  it('prefers requested balance when present', () => {
    expect(
      selectInventoryBalance(warehouses, 'bal-inactive')?.balanceId,
    ).toBe('bal-inactive');
  });

  it('defaults to first active warehouse', () => {
    expect(selectInventoryBalance(warehouses)?.balanceId).toBe('bal-active');
  });

  it('falls back to first warehouse when none active', () => {
    expect(
      selectInventoryBalance([{ balanceId: 'only', warehouseActive: false }])
        ?.balanceId,
    ).toBe('only');
  });
});
