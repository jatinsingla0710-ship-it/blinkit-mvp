import { useEffect, useState } from 'react';
import { Button } from '@groaurum/ui';
import type { ProductsFilterState } from '@/components/products/ProductsBrowseBar';
import '@/components/ui/ListToolbar.css';

type Props = {
  filters: ProductsFilterState;
  categories: readonly { value: string; label: string }[];
  onChange: (next: ProductsFilterState) => void;
  onReset?: () => void;
  onAdd?: () => void;
};

export function ProductsListToolbar({
  filters,
  categories,
  onChange,
  onReset,
  onAdd,
}: Props) {
  const [draft, setDraft] = useState(filters.search);

  useEffect(() => {
    setDraft(filters.search);
  }, [filters.search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (draft !== filters.search) {
        onChange({ ...filters, search: draft });
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [draft, filters, onChange]);

  return (
    <div className="ga-list-toolbar">
      <div className="ga-list-toolbar__search-wrap">
        <input
          type="search"
          className="ga-list-toolbar__search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search products…"
          aria-label="Search products"
        />
      </div>
      <select
        className="ga-list-toolbar__select"
        value={filters.category}
        onChange={(e) => onChange({ ...filters, category: e.target.value })}
        aria-label="Category filter"
      >
        <option value="all">All categories</option>
        {categories.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <select
        className="ga-list-toolbar__select"
        value={filters.stockStatus}
        onChange={(e) =>
          onChange({
            ...filters,
            stockStatus: e.target.value as ProductsFilterState['stockStatus'],
          })
        }
        aria-label="Stock status filter"
      >
        <option value="all">All stock</option>
        <option value="in_stock">In stock</option>
        <option value="low_stock">Low stock</option>
        <option value="out_of_stock">Out of stock</option>
      </select>
      {onReset ? (
        <Button
          variant="secondary"
          onClick={() => {
            setDraft('');
            onReset();
          }}
        >
          Reset filters
        </Button>
      ) : null}
      {onAdd ? (
        <Button variant="primary" onClick={onAdd}>
          Add Product
        </Button>
      ) : null}
    </div>
  );
}
