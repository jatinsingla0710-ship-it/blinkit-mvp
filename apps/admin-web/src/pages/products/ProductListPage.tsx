import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@groaurum/auth/react';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { ProductFormModal } from '@/components/products/ProductFormModal';
import { ProductListTable } from '@/components/products/ProductListTable';
import {
  ProductListKpiCards,
  filterProductsByKpi,
  type ProductListKpiFilter,
} from '@/components/products/ProductListKpiCards';
import { ProductsListToolbar } from '@/components/products/ProductsListToolbar';
import {
  EMPTY_PRODUCTS_FILTERS,
  filterProductRows,
  type ProductsFilterState,
} from '@/components/products/ProductsBrowseBar';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useProductsListQuery } from '@/data/hooks';
import { PRODUCTS_SECTION_LINKS } from '@/data/section-links';
import './ProductListPage.css';

export function ProductListPage() {
  const navigate = useNavigate();
  const { state } = useProductsListQuery();
  const { hasPermission } = usePermissions();
  const canManageProducts = hasPermission('products:manage');
  const [filters, setFilters] = useState<ProductsFilterState>(
    EMPTY_PRODUCTS_FILTERS,
  );
  const [kpiFilter, setKpiFilter] = useState<ProductListKpiFilter>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const onKpiFilter = (filter: ProductListKpiFilter) => {
    setKpiFilter(filter);
    if (filter === 'in_stock') {
      setFilters((current) => ({ ...current, stockStatus: 'in_stock' }));
    } else if (filter === 'low_stock') {
      setFilters((current) => ({ ...current, stockStatus: 'low_stock' }));
    } else if (filter === 'out_of_stock') {
      setFilters((current) => ({ ...current, stockStatus: 'out_of_stock' }));
    } else if (filter === 'all') {
      setFilters((current) => ({ ...current, stockStatus: 'all' }));
    } else if (filter === 'active') {
      setFilters((current) => ({
        ...current,
        status: 'published',
        stockStatus: 'all',
      }));
    }
  };

  return (
    <QueryStateGate title="Products" state={state}>
      {(rows) => {
        const kpiFiltered = filterProductsByKpi(rows, kpiFilter);
        const filtered = filterProductRows(kpiFiltered, filters);
        const categories = [
          ...new Set(rows.map((r) => r.categoryName).filter(Boolean)),
        ]
          .sort()
          .map((name) => ({ value: name, label: name }));

        return (
          <div className="ga-product-list">
            <header className="ga-product-list__header">
              <div>
                <h1 className="ga-product-list__title">Products</h1>
                <p className="ga-product-list__subtitle">
                  Catalogue for Salesaurum — price, stock, and packs
                </p>
              </div>
            </header>

            <SectionRelatedLinks
              label="Products section"
              links={[...PRODUCTS_SECTION_LINKS]}
            />

            <ProductListKpiCards
              rows={rows}
              activeFilter={kpiFilter}
              onFilter={onKpiFilter}
            />

            <ProductsListToolbar
              filters={filters}
              categories={categories}
              onChange={setFilters}
              onAdd={canManageProducts ? () => setCreateOpen(true) : undefined}
            />

            <div className="ga-product-list__summary">
              Showing {filtered.length} of {rows.length}
            </div>

            <ProductListTable rows={filtered} />

            {canManageProducts ? (
              <ProductFormModal
                open={createOpen}
                mode="create"
                onClose={() => setCreateOpen(false)}
                onCreated={(id) => navigate(`/products/${id}`)}
              />
            ) : null}
          </div>
        );
      }}
    </QueryStateGate>
  );
}
