import type { ProductDetail } from '@/data/product-types';
import {
  InventoryStatusBadge,
  PublishStatusBadge,
} from '@/components/products/ProductStatusBadges';
import { Button } from '@/components/ui/Button';
import '@groaurum/ui/styles/data-table.css';
import './ProductOverviewTab.css';

type Props = {
  product: ProductDetail;
  onEdit?: () => void;
};

export function ProductOverviewTab({ product, onEdit }: Props) {
  return (
    <div className="ga-overview">
      {onEdit ? (
        <div className="ga-overview__toolbar">
          <Button variant="secondary" onClick={onEdit}>
            Edit Product
          </Button>
        </div>
      ) : null}
      <dl className="ga-overview__grid">
        <div>
          <dt>Category</dt>
          <dd>{product.categoryName}</dd>
        </div>
        <div>
          <dt>Product type</dt>
          <dd>{product.productType}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{product.isActive ? 'Active' : 'Inactive'}</dd>
        </div>
        <div>
          <dt>Publish status</dt>
          <dd>
            <PublishStatusBadge status={product.publishStatus} />
          </dd>
        </div>
        <div>
          <dt>Inventory status</dt>
          <dd>
            <InventoryStatusBadge status={product.inventoryStatus} />
          </dd>
        </div>
        <div>
          <dt>SKU count</dt>
          <dd>{product.skuCount}</dd>
        </div>
        <div>
          <dt>Current trade price</dt>
          <dd>{product.currentTradePriceLabel}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{product.updatedAtLabel}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{product.createdAtLabel}</dd>
        </div>
        <div>
          <dt>Images</dt>
          <dd>{product.hasImage ? `${product.images.length} on file` : 'None'}</dd>
        </div>
        <div>
          <dt>Brand</dt>
          <dd className="ga-overview__muted">Not supported</dd>
        </div>
      </dl>
      {product.description ? (
        <div className="ga-overview__desc">
          <p className="ga-overview__desc-label">Description</p>
          <p className="ga-overview__desc-body">{product.description}</p>
        </div>
      ) : null}
    </div>
  );
}
