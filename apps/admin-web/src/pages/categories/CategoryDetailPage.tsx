import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePermissions } from '@groaurum/auth/react';
import { Button, Card, EmptyState } from '@groaurum/ui';
import { ProductFormModal } from '@/components/products/ProductFormModal';
import {
  InventoryStatusBadge,
  PublishStatusBadge,
} from '@/components/products/ProductStatusBadges';
import { Badge } from '@/components/ui/Badge';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import {
  useCategoriesListQuery,
  useProductsListQuery,
} from '@/data/hooks';
import { formatMutationError } from '@/data/mutation-errors';
import { useUpdateCategoryMutation } from '@/data/mutations';
import type { ProductListRow } from '@/data/product-types';
import './CategoryDetailPage.css';

type StockFilter = 'all' | 'active' | 'low_stock' | 'out_of_stock';

export function CategoryDetailPage() {
  const navigate = useNavigate();
  const { categoryId } = useParams<{ categoryId: string }>();
  const { state: categoriesState } = useCategoriesListQuery();
  const productsQuery = useProductsListQuery();
  const { hasPermission } = usePermissions();
  const canManageProducts = hasPermission('products:manage');
  const updateCategory = useUpdateCategoryMutation();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StockFilter>('all');
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  if (!categoryId) {
    return (
      <div className="ga-cat-detail-fallback">
        <Link to="/categories">← Categories</Link>
        <Card>
          <EmptyState title="Category not found" detail="No category selected." />
        </Card>
      </div>
    );
  }

  if (categoriesState.isLoading || productsQuery.isPending) {
    return <PageSkeleton title="Category" />;
  }

  if (categoriesState.isError) {
    return (
      <div className="ga-cat-detail-fallback">
        <Link to="/categories">← Categories</Link>
        <Card>
          <EmptyState
            title="Couldn't load category"
            detail={categoriesState.error?.message ?? 'Unexpected error'}
          />
        </Card>
      </div>
    );
  }

  const category =
    (categoriesState.data ?? []).find((c) => c.id === categoryId) ?? null;

  if (!category) {
    return (
      <div className="ga-cat-detail-fallback">
        <Link to="/categories">← Categories</Link>
        <Card>
          <EmptyState
            title="Category not found"
            detail="This category may have been removed."
          />
        </Card>
      </div>
    );
  }

  const productsInCategory = (productsQuery.data ?? []).filter(
    (p) => p.categoryId === category.id,
  );

  const filtered = productsInCategory.filter((row) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      row.name.toLowerCase().includes(q) ||
      (row.primarySkuCode?.toLowerCase().includes(q) ?? false);
    if (!matchesSearch) return false;
    if (filter === 'active') return row.publishStatus === 'published';
    if (filter === 'low_stock') return row.inventoryStatus === 'low_stock';
    if (filter === 'out_of_stock') return row.inventoryStatus === 'out_of_stock';
    return true;
  });

  const openEdit = () => {
    setEditName(category.name);
    setEditError(null);
    setEditOpen(true);
  };

  const saveEdit = () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError('Name is required');
      return;
    }
    setEditError(null);
    updateCategory.mutate(
      { id: category.id, input: { name: trimmed } },
      {
        onSuccess: () => setEditOpen(false),
        onError: (err) =>
          setEditError(formatMutationError(err, 'Could not update category')),
      },
    );
  };

  return (
    <div className="ga-cat-detail">
      <header className="ga-cat-detail__header">
        <div>
          <nav className="ga-cat-detail__crumbs" aria-label="Breadcrumb">
            <Link to="/products">Products</Link>
            <span>/</span>
            <Link to="/categories">Categories</Link>
            <span>/</span>
            <span aria-current="page">{category.name}</span>
          </nav>
          <div className="ga-cat-detail__title-row">
            <span className="ga-cat-detail__avatar" aria-hidden>
              {category.name.trim().charAt(0).toUpperCase() || 'C'}
            </span>
            <div>
              <h1 className="ga-cat-detail__title">{category.name}</h1>
              <p className="ga-cat-detail__meta">
                {category.productCount} Products · {category.activeProductCount}{' '}
                Active · {category.lowStockCount} Low Stock ·{' '}
                {category.outOfStockCount} Out of Stock
              </p>
              <Badge
                tone={category.status === 'active' ? 'success' : 'neutral'}
              >
                {category.status === 'active' ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        </div>
        {canManageProducts ? (
          <div className="ga-cat-detail__actions">
            <Button variant="secondary" onClick={openEdit}>
              Edit Category
            </Button>
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              Add Product
            </Button>
          </div>
        ) : null}
      </header>

      {editOpen ? (
        <Card title="Edit Category">
          <div className="ga-cat-detail__edit">
            <label>
              Category name
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit();
                }}
              />
            </label>
            <div className="ga-cat-detail__edit-actions">
              <Button
                variant="primary"
                onClick={saveEdit}
                disabled={updateCategory.isPending}
              >
                Save
              </Button>
              <Button variant="ghost" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
            </div>
            {editError ? (
              <p className="ga-cat-detail__error">{editError}</p>
            ) : null}
          </div>
        </Card>
      ) : null}

      <section className="ga-cat-detail__products">
        <div className="ga-cat-detail__toolbar">
          <h2>Products in {category.name}</h2>
          <div className="ga-cat-detail__filters">
            <input
              className="ga-cat-detail__search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products in this category"
              aria-label="Search products in this category"
            />
            <div className="ga-cat-detail__chips" role="group" aria-label="Filter">
              {(
                [
                  ['all', 'All'],
                  ['active', 'Active'],
                  ['low_stock', 'Low Stock'],
                  ['out_of_stock', 'Out of Stock'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={
                    filter === id
                      ? 'ga-cat-detail__chip is-active'
                      : 'ga-cat-detail__chip'
                  }
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <Card>
            <div className="ga-cat-detail__empty">
              <p>
                {productsInCategory.length === 0
                  ? 'No products in this category yet.'
                  : 'No products match your search.'}
              </p>
              {canManageProducts && productsInCategory.length === 0 ? (
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  Add Product
                </Button>
              ) : null}
            </div>
          </Card>
        ) : (
          <div className="ga-cat-detail__product-list">
            {filtered.map((row) => (
              <CategoryProductRow
                key={row.id}
                row={row}
                categoryId={category.id}
              />
            ))}
          </div>
        )}
      </section>

      {canManageProducts ? (
        <ProductFormModal
          open={createOpen}
          mode="create"
          initialCategoryId={category.id}
          onClose={() => setCreateOpen(false)}
          onCreated={(id) =>
            navigate(`/products/${id}?fromCategory=${category.id}`)
          }
        />
      ) : null}
    </div>
  );
}

function CategoryProductRow({
  row,
  categoryId,
}: {
  row: ProductListRow;
  categoryId: string;
}) {
  return (
    <Link
      to={`/products/${row.id}?fromCategory=${categoryId}`}
      className="ga-cat-product"
    >
      <div className="ga-cat-product__main">
        {row.imageUrl ? (
          <img src={row.imageUrl} alt="" className="ga-cat-product__thumb" />
        ) : (
          <span className="ga-cat-product__thumb ga-cat-product__thumb--empty" />
        )}
        <div>
          <p className="ga-cat-product__name">{row.name}</p>
          <p className="ga-cat-product__price">{row.currentTradePriceLabel}</p>
        </div>
      </div>
      <div className="ga-cat-product__side">
        <span className="ga-cat-product__stock">
          {row.availableStockLabel ?? '—'}
        </span>
        <div className="ga-cat-product__badges">
          <PublishStatusBadge status={row.publishStatus} />
          <InventoryStatusBadge status={row.inventoryStatus} />
        </div>
      </div>
    </Link>
  );
}
