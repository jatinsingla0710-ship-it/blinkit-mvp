/**
 * Product list filter helpers — browse UI removed in Phase 4H;
 * ProductsListToolbar is the production filter surface.
 */
import type { ProductPublishStatus } from '@/data/product-types';

export type ProductsFilterState = {
  search: string;
  status: 'all' | ProductPublishStatus;
  category: string;
  stockStatus: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
};

export const EMPTY_PRODUCTS_FILTERS: ProductsFilterState = {
  search: '',
  status: 'all',
  category: 'all',
  stockStatus: 'all',
};

export function filterProductRows<
  T extends {
    name: string;
    categoryName: string;
    publishStatus: ProductPublishStatus;
    primarySkuCode?: string;
    inventoryStatus: 'in_stock' | 'low_stock' | 'out_of_stock' | 'not_tracked';
  },
>(rows: readonly T[], filters: ProductsFilterState): T[] {
  const q = filters.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.status !== 'all' && row.publishStatus !== filters.status) {
      return false;
    }
    if (filters.category !== 'all' && row.categoryName !== filters.category) {
      return false;
    }
    if (
      filters.stockStatus !== 'all' &&
      row.inventoryStatus !== filters.stockStatus
    ) {
      return false;
    }
    if (!q) return true;
    return (
      row.name.toLowerCase().includes(q) ||
      row.categoryName.toLowerCase().includes(q) ||
      (row.primarySkuCode?.toLowerCase().includes(q) ?? false)
    );
  });
}
