import { Link } from 'react-router-dom';
import type { ProductDetail } from '@/data/product-types';
import { firstUnpricedActiveSkuId } from '@/data/product-readiness';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import './ProductWorkflowNextSteps.css';

type Props = {
  product: ProductDetail;
  onAddSku: () => void;
  onPublish: () => void;
  onEdit?: () => void;
  publishPending?: boolean;
  canManageProducts?: boolean;
  canManagePricing?: boolean;
};

type StepState = 'done' | 'todo' | 'optional';

function StepMark({ state }: { state: StepState }) {
  if (state === 'done') {
    return <span className="ga-product-workflow__mark ga-product-workflow__mark--done">✓</span>;
  }
  if (state === 'optional') {
    return <span className="ga-product-workflow__mark ga-product-workflow__mark--optional">○</span>;
  }
  return <span className="ga-product-workflow__mark ga-product-workflow__mark--todo">○</span>;
}

/**
 * Guides admins through Product → Pack → Price → Inventory → Publish.
 * Changes with product state; never shows a faded Publish when already published.
 */
export function ProductWorkflowNextSteps({
  product,
  onAddSku,
  onPublish,
  onEdit,
  publishPending = false,
  canManageProducts = false,
  canManagePricing = false,
}: Props) {
  const unpricedSkuId = firstUnpricedActiveSkuId(product.skus);
  const firstActiveSku = product.skus.find((sku) => sku.isActive);
  const stockSkuId = firstActiveSku?.id;
  const checklistByKey = new Map(product.checklist.map((item) => [item.key, item]));
  const missingRequired = product.checklist.filter(
    (item) => !item.optional && !item.ready,
  );
  const hasPack = (checklistByKey.get('sku')?.ready ?? false) && product.skuCount > 0;
  const hasPrice = checklistByKey.get('current_price')?.ready ?? false;
  const hasInventory = checklistByKey.get('inventory')?.ready ?? false;
  const published = product.publishStatus === 'published';
  const archived = product.publishStatus === 'archived';
  const readyToPublish = product.canPublish && !published && !archived;

  if (published) {
    return (
      <Card title="Next Steps">
        <p className="ga-product-workflow__published">
          <span className="ga-product-workflow__mark ga-product-workflow__mark--done">✓</span>
          Product Published
        </p>
        <p className="ga-product-workflow__detail">
          Customers can see this product
          {product.inventoryStatus === 'out_of_stock' ||
          product.inventoryStatus === 'not_tracked'
            ? ' (may show OUT OF STOCK until inventory is added)'
            : ''}
          .
        </p>
        <div className="ga-product-workflow__actions">
          {canManageProducts ? (
            <Button variant="secondary" onClick={onAddSku}>
              Manage Packs
            </Button>
          ) : null}
          {firstActiveSku && canManagePricing ? (
            <Link
              to={`/pricing/${firstActiveSku.id}`}
              className="ga-product-workflow__link"
            >
              <Button variant="secondary">Update Price</Button>
            </Link>
          ) : null}
          {stockSkuId ? (
            <Link to={`/inventory/${stockSkuId}`} className="ga-product-workflow__link">
              <Button variant="secondary">Add Stock</Button>
            </Link>
          ) : null}
          {canManageProducts && onEdit ? (
            <Button variant="secondary" onClick={onEdit}>
              Edit Product
            </Button>
          ) : null}
        </div>
      </Card>
    );
  }

  if (archived) {
    return (
      <Card title="Next Steps">
        <p className="ga-product-workflow__detail">
          This product is archived / deleted and cannot be published.
        </p>
      </Card>
    );
  }

  const packState: StepState = hasPack ? 'done' : 'todo';
  const priceState: StepState = hasPrice ? 'done' : 'todo';
  const inventoryState: StepState = hasInventory ? 'done' : 'optional';

  return (
    <Card title="Next Steps">
      <ol className="ga-product-workflow ga-product-workflow--checklist">
        <li className="ga-product-workflow__item">
          <StepMark state="done" />
          <div>
            <p className="ga-product-workflow__label">Product Details</p>
            <p className="ga-product-workflow__detail">Name and category are set</p>
          </div>
        </li>

        <li className="ga-product-workflow__item">
          <StepMark state={packState} />
          <div>
            <p className="ga-product-workflow__label">Selling Pack</p>
            <p className="ga-product-workflow__detail">
              {hasPack
                ? `${product.skuCount} selling pack${product.skuCount === 1 ? '' : 's'}`
                : 'Add at least one selling pack'}
            </p>
          </div>
          {canManageProducts ? (
            <Button variant="secondary" onClick={onAddSku}>
              {hasPack ? 'Manage Packs' : 'Add Pack'}
            </Button>
          ) : null}
        </li>

        <li className="ga-product-workflow__item">
          <StepMark state={priceState} />
          <div>
            <p className="ga-product-workflow__label">Price</p>
            <p className="ga-product-workflow__detail">
              {hasPrice
                ? 'Trade price is set'
                : 'Set a customer pack price'}
            </p>
          </div>
          {unpricedSkuId && canManagePricing ? (
            <Link to={`/pricing/${unpricedSkuId}`} className="ga-product-workflow__link">
              <Button variant="secondary">Set Price</Button>
            </Link>
          ) : null}
        </li>

        <li className="ga-product-workflow__item">
          <StepMark state={inventoryState} />
          <div>
            <p className="ga-product-workflow__label">Inventory (Optional)</p>
            <p className="ga-product-workflow__detail">
              {hasInventory
                ? 'Stock on hand recorded'
                : 'Not required — customers see OUT OF STOCK without it'}
            </p>
          </div>
          {stockSkuId ? (
            <Link to={`/inventory/${stockSkuId}`} className="ga-product-workflow__link">
              <Button variant="secondary">Add Stock</Button>
            </Link>
          ) : null}
        </li>

        <li className="ga-product-workflow__item">
          <StepMark state={readyToPublish ? 'todo' : 'todo'} />
          <div>
            <p className="ga-product-workflow__label">Publish</p>
            <p className="ga-product-workflow__detail">
              {readyToPublish
                ? 'Ready for customer catalogue'
                : missingRequired.length > 0
                  ? `Cannot publish yet — still needed: ${missingRequired
                      .map((item) => item.label)
                      .join(', ')}`
                  : 'Complete required steps above'}
            </p>
            {missingRequired.length > 0 ? (
              <ul className="ga-product-workflow__missing">
                {product.checklist
                  .filter((item) => !item.optional)
                  .map((item) => (
                    <li key={item.key}>
                      {item.ready ? '✓' : '✗'} {item.label}
                      {item.optional ? '' : item.ready ? ' complete' : ' missing'}
                    </li>
                  ))}
              </ul>
            ) : null}
          </div>
          <Button
            variant="primary"
            onClick={onPublish}
            disabled={
              !canManageProducts || !readyToPublish || publishPending
            }
            title={
              readyToPublish
                ? 'Publish to customer catalogue'
                : missingRequired.length > 0
                  ? `Still needed: ${missingRequired.map((i) => i.label).join(', ')}`
                  : 'Complete required fields'
            }
          >
            {publishPending ? 'Publishing…' : 'Publish Product'}
          </Button>
        </li>
      </ol>
    </Card>
  );
}
