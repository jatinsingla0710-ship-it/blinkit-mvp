import type { ProductListRow } from '@/data/product-types';
import './ProductListKpiCards.css';

export type ProductListKpiFilter =
  | 'all'
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'active';

type Stat = {
  id: ProductListKpiFilter;
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'warning' | 'danger';
};

type Props = {
  rows: readonly ProductListRow[];
  activeFilter: ProductListKpiFilter;
  onFilter: (filter: ProductListKpiFilter) => void;
};

export function ProductListKpiCards({ rows, activeFilter, onFilter }: Props) {
  const published = rows.filter((row) => row.publishStatus === 'published').length;
  const inStock = rows.filter((row) => row.inventoryStatus === 'in_stock').length;
  const lowStock = rows.filter((row) => row.inventoryStatus === 'low_stock').length;
  const outOfStock = rows.filter(
    (row) => row.inventoryStatus === 'out_of_stock',
  ).length;

  const stats: Stat[] = [
    { id: 'all', label: 'Total', value: `${rows.length}` },
    { id: 'active', label: 'Published', value: `${published}`, tone: 'positive' },
    { id: 'in_stock', label: 'In Stock', value: `${inStock}`, tone: 'positive' },
    { id: 'low_stock', label: 'Low Stock', value: `${lowStock}`, tone: 'warning' },
    {
      id: 'out_of_stock',
      label: 'Out of Stock',
      value: `${outOfStock}`,
      tone: 'danger',
    },
  ];

  return (
    <div className="ga-product-stats" role="group" aria-label="Product summary">
      {stats.map((stat) => {
        const className = [
          'ga-product-stat',
          stat.tone ? `ga-product-stat--${stat.tone}` : '',
          activeFilter === stat.id ? 'ga-product-stat--active' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={stat.id}
            type="button"
            className={className}
            onClick={() => onFilter(stat.id)}
          >
            <span className="ga-product-stat__value">{stat.value}</span>
            <span className="ga-product-stat__label">{stat.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function filterProductsByKpi(
  rows: readonly ProductListRow[],
  filter: ProductListKpiFilter,
): ProductListRow[] {
  if (filter === 'all') return [...rows];
  if (filter === 'active') {
    return rows.filter((row) => row.publishStatus === 'published');
  }
  if (filter === 'in_stock') {
    return rows.filter((row) => row.inventoryStatus === 'in_stock');
  }
  if (filter === 'low_stock') {
    return rows.filter((row) => row.inventoryStatus === 'low_stock');
  }
  return rows.filter((row) => row.inventoryStatus === 'out_of_stock');
}
