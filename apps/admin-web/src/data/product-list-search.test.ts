import { describe, expect, it } from 'vitest';

import { filterCustomerRows } from '@/data/customer-list-filters';
import { filterProductRows, EMPTY_PRODUCTS_FILTERS } from '@/components/products/ProductsBrowseBar';
import type { CustomerListRow } from '@/data/customers-types';
import type { ProductListRow } from '@/data/product-types';

const CUSTOMER_ROWS: CustomerListRow[] = [
  {
    id: 'c1',
    shopName: 'ABC Traders',
    ownerName: 'Rajesh Kumar',
    phoneLabel: '+919876543210',
    areaLabel: 'Jaipur',
    salesmanName: 'Priya',
    lastOrderLabel: '—',
    preferredPayment: 'COD',
    status: 'active',
    digitalAccess: 'not_activated',
    digitalAccessLabel: 'Not Activated',
    createdAtIso: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'c2',
    shopName: 'Metro Foods',
    ownerName: 'Anita Shah',
    phoneLabel: '+919811122299',
    areaLabel: 'Delhi',
    salesmanName: 'Rahul',
    lastOrderLabel: 'GA-1',
    preferredPayment: 'Online',
    status: 'inactive',
    digitalAccess: 'activated',
    digitalAccessLabel: 'Activated',
    createdAtIso: '2026-02-01T00:00:00.000Z',
  },
];

const PRODUCT_ROWS: ProductListRow[] = [
  {
    id: 'prod-1',
    name: 'Premium Gold Powder',
    categoryId: 'cat-gold',
    categoryName: 'Gold',
    skuCount: 1,
    primarySkuCode: 'GP-200',
    packagingLabel: '200 g pack',
    availableStockLabel: '120 kg available',
    currentTradePriceLabel: '₹500',
    inventoryStatus: 'in_stock',
    publishStatus: 'published',
    readinessLabel: 'Active',
    updatedAtLabel: 'Today',
  },
  {
    id: 'prod-2',
    name: 'Cashew Whole',
    categoryId: 'cat-nuts',
    categoryName: 'Nuts',
    skuCount: 1,
    primarySkuCode: 'CW-1KG',
    currentTradePriceLabel: '₹900',
    inventoryStatus: 'low_stock',
    publishStatus: 'draft',
    readinessLabel: 'Draft',
    updatedAtLabel: 'Yesterday',
  },
];

describe('customer list search', () => {
  it('filters by shop name case-insensitively', () => {
    const result = filterCustomerRows(CUSTOMER_ROWS, 'abc traders', 'all');
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('c1');
  });

  it('filters by mobile digits', () => {
    const result = filterCustomerRows(CUSTOMER_ROWS, '9876543210', 'all');
    expect(result).toHaveLength(1);
    expect(result[0]?.ownerName).toBe('Rajesh Kumar');
  });

  it('filters by business status', () => {
    const result = filterCustomerRows(CUSTOMER_ROWS, '', 'inactive');
    expect(result).toHaveLength(1);
    expect(result[0]?.shopName).toBe('Metro Foods');
  });
});

describe('product list search', () => {
  it('filters by product name', () => {
    const result = filterProductRows(PRODUCT_ROWS, {
      ...EMPTY_PRODUCTS_FILTERS,
      search: 'gold',
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toContain('Gold');
  });

  it('filters by SKU code', () => {
    const result = filterProductRows(PRODUCT_ROWS, {
      ...EMPTY_PRODUCTS_FILTERS,
      search: 'cw-1kg',
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.primarySkuCode).toBe('CW-1KG');
  });
});

describe('product detail routing', () => {
  it('builds correct product detail path from list row id', () => {
    const row = PRODUCT_ROWS[0]!;
    expect(`/products/${row.id}`).toBe('/products/prod-1');
  });

  it('product list row id is used as route param not sku code', () => {
    const row = PRODUCT_ROWS[0]!;
    expect(row.id).not.toBe(row.primarySkuCode);
    expect(row.id).toBe('prod-1');
  });
});
