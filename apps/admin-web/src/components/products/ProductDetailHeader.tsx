import { Link } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import type { ProductDetail } from '@/data/product-types';
import {
  InventoryStatusBadge,
  PublishStatusBadge,
} from '@/components/products/ProductStatusBadges';
import './ProductDetailHeader.css';

type Props = {
  product: ProductDetail;
  canManage: boolean;
  onEdit: () => void;
  onAdjustStock: () => void;
  onManageImages?: () => void;
  onDelete?: () => void;
  breadcrumbParent?: { label: string; to: string };
};

export function ProductDetailHeader({
  product,
  canManage,
  onEdit,
  onAdjustStock,
  onManageImages,
  onDelete,
  breadcrumbParent,
}: Props) {
  const primarySku = product.skus.find((sku) => sku.isActive) ?? product.skus[0];

  return (
    <header className="ga-product-detail-header">
      <div className="ga-product-detail-header__main">
        <nav className="ga-product-detail-header__crumbs" aria-label="Breadcrumb">
          <Link to="/products">Products</Link>
          {breadcrumbParent ? (
            <>
              <span>/</span>
              <Link to={breadcrumbParent.to}>{breadcrumbParent.label}</Link>
            </>
          ) : null}
          <span>/</span>
          <span aria-current="page">{product.name}</span>
        </nav>

        <div className="ga-product-detail-header__identity">
          <div>
            <h1 className="ga-product-detail-header__title">{product.name}</h1>
            <p className="ga-product-detail-header__meta-line">
              {primarySku ? (
                <span className="ga-table__mono">{primarySku.skuCode}</span>
              ) : (
                'No selling pack yet'
              )}
            </p>
            <p className="ga-product-detail-header__category">
              Category:{' '}
              <Link to={`/categories/${product.categoryId}`}>
                {product.categoryName}
              </Link>
            </p>
            <div className="ga-product-detail-header__badges">
              <PublishStatusBadge status={product.publishStatus} />
              <InventoryStatusBadge status={product.inventoryStatus} />
            </div>
            {product.publishStatus === 'draft' ? (
              <p className="ga-product-detail-header__visibility" role="status">
                Draft — not shown to salesmen until Published with an active price.
              </p>
            ) : null}
            {product.publishStatus === 'archived' ? (
              <p className="ga-product-detail-header__visibility" role="status">
                Archived — hidden from salesmen.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {canManage ? (
        <div className="ga-product-detail-header__actions">
          <Button variant="primary" onClick={onEdit}>
            Edit Product
          </Button>
          <details className="ga-product-detail-header__more">
            <summary>More Actions</summary>
            <div className="ga-product-detail-header__more-menu">
              {primarySku ? (
                <button type="button" onClick={onAdjustStock}>
                  Update Stock
                </button>
              ) : null}
              {onManageImages ? (
                <button type="button" onClick={onManageImages}>
                  Manage Images
                </button>
              ) : null}
              {primarySku ? (
                <Link to={`/inventory/${primarySku.id}`}>View Inventory History</Link>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  className="ga-product-detail-header__danger"
                  onClick={onDelete}
                >
                  Delete Product
                </button>
              ) : null}
            </div>
          </details>
        </div>
      ) : null}
    </header>
  );
}
