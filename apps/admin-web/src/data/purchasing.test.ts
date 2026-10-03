import { describe, expect, it } from 'vitest';
import {
  filterPurchaseRows,
  filterSupplierRows,
  purchaseLineTotal,
  purchaseTotals,
} from './purchasing';

describe('Phase 5A purchasing helpers', () => {
  it('computes line and purchase totals independently of selling price', () => {
    expect(purchaseLineTotal(10, 25.5)).toBe(255);
    expect(
      purchaseTotals(
        [
          { skuId: 'a', quantity: 2, unitCost: 10 },
          { skuId: 'b', quantity: 1.5, unitCost: 20 },
        ],
        5,
      ),
    ).toEqual({ subtotal: 50, taxAmount: 5, total: 55 });
  });

  it('filters suppliers by search and active status', () => {
    const rows = [
      {
        id: '1',
        name: 'Acme Foods',
        contactPerson: 'Ravi',
        mobileLabel: '+919876543210',
        email: null,
        addressLine: null,
        city: 'Delhi',
        state: null,
        gstin: '07AAAAA0000A1Z5',
        notes: null,
        isActive: true,
        statusLabel: 'Active',
        createdAtLabel: '',
        updatedAtLabel: '',
      },
      {
        id: '2',
        name: 'Old Vendor',
        contactPerson: null,
        mobileLabel: null,
        email: null,
        addressLine: null,
        city: 'Pune',
        state: null,
        gstin: null,
        notes: null,
        isActive: false,
        statusLabel: 'Inactive',
        createdAtLabel: '',
        updatedAtLabel: '',
      },
    ];
    expect(filterSupplierRows(rows, 'acme', 'all')).toHaveLength(1);
    expect(filterSupplierRows(rows, '', 'active')).toHaveLength(1);
    expect(filterSupplierRows(rows, 'pune', 'inactive')).toHaveLength(1);
  });

  it('filters purchases by status and bill search', () => {
    const rows = [
      {
        id: 'p1',
        supplierId: 's1',
        supplierName: 'Acme',
        warehouseId: 'w1',
        warehouseName: 'Main',
        purchaseDate: '2026-10-01',
        purchaseDateLabel: '01 Oct 2026',
        billNumber: 'INV-100',
        status: 'DRAFT' as const,
        statusLabel: 'Draft',
        itemCount: 2,
        subtotal: 100,
        taxAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        supplyType: 'UNSET' as const,
        total: 100,
        totalLabel: '₹100',
      },
      {
        id: 'p2',
        supplierId: 's1',
        supplierName: 'Acme',
        warehouseId: 'w1',
        warehouseName: 'Main',
        purchaseDate: '2026-10-02',
        purchaseDateLabel: '02 Oct 2026',
        billNumber: 'INV-200',
        status: 'RECEIVED' as const,
        statusLabel: 'Received',
        itemCount: 1,
        subtotal: 50,
        taxAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        supplyType: 'UNSET' as const,
        total: 50,
        totalLabel: '₹50',
      },
    ];
    expect(filterPurchaseRows(rows, { status: 'DRAFT' })).toHaveLength(1);
    expect(filterPurchaseRows(rows, { query: 'inv-200' })).toHaveLength(1);
    expect(
      filterPurchaseRows(rows, { dateFrom: '2026-10-02', dateTo: '2026-10-02' }),
    ).toHaveLength(1);
  });
});
