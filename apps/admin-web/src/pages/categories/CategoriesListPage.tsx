import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePermissions } from '@groaurum/auth/react';
import { ActionBar } from '@groaurum/ui';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useCategoriesListQuery, useProductsListQuery } from '@/data/hooks';
import {
  useCreateCategoryMutation,
  useSoftDeleteCategoryMutation,
  useUpdateCategoryMutation,
} from '@/data/mutations';
import { formatMutationError } from '@/data/mutation-errors';
import { PRODUCTS_SECTION_LINKS } from '@/data/section-links';
import './CategoriesListPage.css';

/**
 * Categories catalogue taxonomy — clickable cards → category detail.
 */
export function CategoriesListPage() {
  const { state } = useCategoriesListQuery();
  const productsQuery = useProductsListQuery();
  const { hasPermission } = usePermissions();
  const canManageProducts = hasPermission('products:manage');
  const createCategory = useCreateCategoryMutation();
  const updateCategory = useUpdateCategoryMutation();
  const softDeleteCategory = useSoftDeleteCategoryMutation();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const productTotals = useMemo(() => {
    const rows = productsQuery.data ?? [];
    return {
      total: rows.length,
      active: rows.filter((r) => r.publishStatus === 'published').length,
      low: rows.filter((r) => r.inventoryStatus === 'low_stock').length,
      out: rows.filter((r) => r.inventoryStatus === 'out_of_stock').length,
    };
  }, [productsQuery.data]);

  const onCreate = () => {
    if (!canManageProducts) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    setError(null);
    createCategory.mutate(
      { name: trimmed, isActive: true },
      {
        onSuccess: () => {
          setName('');
          setCreateOpen(false);
        },
        onError: (err) =>
          setError(formatMutationError(err, 'Could not create category')),
      },
    );
  };

  return (
    <QueryStateGate title="Categories" state={state}>
      {(rows) => (
        <div className="ga-cat-list">
          <header className="ga-cat-list__header">
            <div>
              <nav className="ga-cat-list__crumbs" aria-label="Breadcrumb">
                <Link to="/products">Products</Link>
                <span>/</span>
                <span aria-current="page">Categories</span>
              </nav>
              <h1 className="ga-cat-list__title">Categories</h1>
              <p className="ga-cat-list__subtitle">
                Manage and organize your products
              </p>
            </div>
            {canManageProducts ? (
              <Button variant="primary" onClick={() => setCreateOpen((v) => !v)}>
                {createOpen ? 'Cancel' : 'Add Category'}
              </Button>
            ) : null}
          </header>

          <SectionRelatedLinks
            label="Products section"
            links={[...PRODUCTS_SECTION_LINKS]}
          />

          <div className="ga-cat-list__stats" role="group" aria-label="Category summary">
            <div className="ga-cat-list__stat">
              <strong>{rows.length}</strong>
              <span>Categories</span>
            </div>
            <div className="ga-cat-list__stat">
              <strong>{productTotals.total}</strong>
              <span>Products</span>
            </div>
            <div className="ga-cat-list__stat ga-cat-list__stat--positive">
              <strong>{productTotals.active}</strong>
              <span>Active</span>
            </div>
            <div className="ga-cat-list__stat ga-cat-list__stat--warning">
              <strong>{productTotals.low + productTotals.out}</strong>
              <span>Low / Out</span>
            </div>
          </div>

          {canManageProducts && createOpen ? (
            <Card title="New Category">
              <div className="ga-cat-list__create">
                <input
                  className="ga-cat-list__input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Category name"
                  aria-label="Category name"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onCreate();
                  }}
                />
                <ActionBar>
                  <Button
                    variant="primary"
                    onClick={onCreate}
                    disabled={createCategory.isPending}
                  >
                    Create Category
                  </Button>
                </ActionBar>
              </div>
              {error ? <p className="ga-cat-list__error">{error}</p> : null}
            </Card>
          ) : null}

          {rows.length === 0 ? (
            <Card>
              <p className="ga-cat-list__empty">No categories yet.</p>
            </Card>
          ) : (
            <div className="ga-cat-list__grid">
              {rows.map((row) => (
                <Link
                  key={row.id}
                  to={`/categories/${row.id}`}
                  className="ga-cat-card"
                >
                  <div className="ga-cat-card__top">
                    <span className="ga-cat-card__avatar" aria-hidden>
                      {row.name.trim().charAt(0).toUpperCase() || 'C'}
                    </span>
                    <Badge
                      tone={row.status === 'active' ? 'success' : 'neutral'}
                    >
                      {row.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <h2 className="ga-cat-card__title">{row.name}</h2>
                  <p className="ga-cat-card__count">
                    {row.productCount} Product{row.productCount === 1 ? '' : 's'}
                  </p>
                  <p className="ga-cat-card__meta">
                    {row.activeProductCount} Active
                    {row.lowStockCount > 0
                      ? ` · ${row.lowStockCount} Low Stock`
                      : ''}
                    {row.outOfStockCount > 0
                      ? ` · ${row.outOfStockCount} Out of Stock`
                      : ''}
                  </p>
                  <div className="ga-cat-card__footer">
                    <span className="ga-cat-card__view">View →</span>
                    {canManageProducts ? (
                      <span
                        className="ga-cat-card__actions"
                        onClick={(e) => e.preventDefault()}
                        onKeyDown={(e) => e.preventDefault()}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            updateCategory.mutate({
                              id: row.id,
                              input: { isActive: row.status !== 'active' },
                            });
                          }}
                        >
                          {row.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            softDeleteCategory.mutate(row.id);
                          }}
                        >
                          Archive
                        </button>
                      </span>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </QueryStateGate>
  );
}
