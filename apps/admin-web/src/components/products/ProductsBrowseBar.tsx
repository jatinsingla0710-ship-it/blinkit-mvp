import { Button, Card, FilterBar, SelectField, TextField } from '@groaurum/ui';
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

type Props = {
  filters: ProductsFilterState;
  categories: readonly { value: string; label: string }[];
  onChange: (next: ProductsFilterState) => void;
  onReset: () => void;
};

export function ProductsBrowseBar({
  filters,
  categories,
  onChange,
  onReset,
}: Props) {
  return (
    <Card
      title="Search & Filters"
      action={
        <Button variant="ghost" onClick={onReset}>
          Reset
        </Button>
      }
    >
      <FilterBar columns="repeat(4, minmax(0, 1fr))">
        <TextField
          label="Search"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Product name or SKU"
        />
        <SelectField
          label="Category"
          value={filters.category}
          onChange={(category) => onChange({ ...filters, category })}
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Stock Status"
          value={filters.stockStatus}
          onChange={(stockStatus) =>
            onChange({
              ...filters,
              stockStatus: stockStatus as ProductsFilterState['stockStatus'],
            })
          }
        >
          <option value="all">All stock levels</option>
          <option value="in_stock">In stock</option>
          <option value="low_stock">Low stock</option>
          <option value="out_of_stock">Out of stock</option>
        </SelectField>
        <SelectField
          label="Publish Status"
          value={filters.status}
          onChange={(status) =>
            onChange({
              ...filters,
              status: status as ProductsFilterState['status'],
            })
          }
        >
          <option value="all">All</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </SelectField>
      </FilterBar>
    </Card>
  );
}

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
