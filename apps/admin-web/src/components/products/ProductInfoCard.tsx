import { Link } from 'react-router-dom';
import type { ProductDetail } from '@/data/product-types';
import { PublishStatusBadge } from '@/components/products/ProductStatusBadges';
import { Card } from '@/components/ui/Card';
import './ProductInfoCard.css';

type Props = {
  product: ProductDetail;
};

export function ProductInfoCard({ product }: Props) {
  const primarySku =
    product.skus.find((sku) => sku.isActive) ?? product.skus[0];

  return (
    <Card title="Overview" className="ga-product-info">
      <dl className="ga-product-info__grid">
        <div>
          <dt>Product name</dt>
          <dd>{product.name}</dd>
        </div>
        <div>
          <dt>Category</dt>
          <dd>
            <Link to={`/categories/${product.categoryId}`}>
              {product.categoryName}
            </Link>
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <PublishStatusBadge status={product.publishStatus} />
          </dd>
        </div>
        {primarySku ? (
          <div>
            <dt>SKU</dt>
            <dd className="ga-table__mono">{primarySku.skuCode}</dd>
          </div>
        ) : null}
        <div>
          <dt>Created</dt>
          <dd>{product.createdAtLabel || '—'}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{product.updatedAtLabel || '—'}</dd>
        </div>
        <div className="ga-product-info__full">
          <dt>Description</dt>
          <dd>{product.description?.trim() || 'No description yet.'}</dd>
        </div>
      </dl>
    </Card>
  );
}
