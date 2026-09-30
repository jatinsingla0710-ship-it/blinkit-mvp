import { useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { usePermissions } from '@groaurum/auth/react';
import { Button, Card, EmptyState } from '@groaurum/ui';
import { ProductFormModal } from '@/components/products/ProductFormModal';
import { ProductDeleteArchiveModal } from '@/components/products/ProductDeleteArchiveModal';
import { ProductInfoCard } from '@/components/products/ProductInfoCard';
import { ProductDetailHeader } from '@/components/products/ProductDetailHeader';
import { ProductImageGallery } from '@/components/products/ProductImageGallery';
import { ProductPackagingCard } from '@/components/products/ProductPackagingCard';
import { ProductPricingPanel } from '@/components/products/ProductPricingPanel';
import { ProductSummaryCards } from '@/components/products/ProductSummaryCards';
import {
  ProductInventoryActivity,
  ProductInventoryOverviewCard,
} from '@/components/products/ProductInventoryOverview';
import { ProductPriceHistoryTab } from '@/components/products/ProductPriceHistoryTab';
import { ProductSkusTab } from '@/components/products/ProductSkusTab';
import { ProductStockAdjustModal } from '@/components/products/ProductStockAdjustModal';
import { ProductWorkflowNextSteps } from '@/components/products/ProductWorkflowNextSteps';
import { PublishChecklist } from '@/components/products/PublishChecklist';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { Card as LocalCard } from '@/components/ui/Card';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { OUTER_PACKAGES, type OuterPackageKey } from '@/data/pack-units';
import { useProductDetailQuery } from '@/data/hooks';
import { formatMutationError } from '@/data/mutation-errors';
import { useUpdateProductMutation } from '@/data/mutations';
import './ProductDetailPage.css';

type DetailTab = 'overview' | 'pricing' | 'inventory' | 'packs';

const TABS: TabItem<DetailTab>[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'inventory', label: 'Stock' },
  { id: 'packs', label: 'Packs' },
];

export function ProductDetailPage() {
  const navigate = useNavigate();
  const { productId } = useParams<{ productId: string }>();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<DetailTab>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustBalanceId, setAdjustBalanceId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const query = useProductDetailQuery(productId);
  const { state, refetch, isFetching } = query;
  const updateProduct = useUpdateProductMutation();
  const { hasPermission } = usePermissions();
  const canManageProducts = hasPermission('products:manage');
  const canManagePricing = hasPermission('pricing:manage');

  const openAdjust = (balanceId?: string) => {
    setAdjustBalanceId(balanceId ?? null);
    setAdjustOpen(true);
  };

  if (!productId) {
    return (
      <ProductDetailFallback
        title="Product not found"
        detail="No product was selected."
      />
    );
  }

  if (state.isLoading) {
    return <PageSkeleton title="Product" />;
  }

  if (state.isError) {
    return (
      <ProductDetailFallback
        title="We couldn't load this product"
        detail={state.error?.message ?? 'Unexpected error loading product.'}
        onRetry={() => void refetch()}
        retrying={isFetching}
      />
    );
  }

  if (state.isEmpty || !state.data) {
    return (
      <ProductDetailFallback
        title="Product not found"
        detail="This product may have been removed or the link is incorrect."
      />
    );
  }

  const product = state.data;
  const primarySku =
    product.skus.find((sku) => sku.isActive) ?? product.skus[0];
  const warehouseStock = product.warehouseStock ?? [];
  const fromCategoryId = searchParams.get('fromCategory');
  const breadcrumbParent = fromCategoryId
    ? {
        label: product.categoryName,
        to: `/categories/${product.categoryId}`,
      }
    : product.categoryId
      ? {
          label: 'Categories',
          to: '/categories',
        }
      : undefined;

  const packagingHint = (() => {
    if (!primarySku?.packsPerCarton) return null;
    const outer =
      OUTER_PACKAGES[(primarySku.outerType ?? 'bag') as OuterPackageKey]
        ?.label ?? 'Bag';
    return `${primarySku.packsPerCarton} Packs = 1 ${outer}`;
  })();

  return (
    <div className="ga-product-detail">
      <div className="ga-product-detail__hero" ref={galleryRef}>
        <ProductImageGallery
          productId={product.id}
          images={product.images}
          canManage={canManageProducts}
        />
        <ProductDetailHeader
          product={product}
          canManage={canManageProducts}
          onEdit={() => setEditOpen(true)}
          onAdjustStock={() => openAdjust()}
          onManageImages={() =>
            galleryRef.current?.scrollIntoView({ behavior: 'smooth' })
          }
          onDelete={() => setDeleteOpen(true)}
          breadcrumbParent={breadcrumbParent}
        />
      </div>

      <ProductSummaryCards product={product} sku={primarySku} />

      <div className="ga-product-detail__layout">
        <div className="ga-product-detail__main">
          {actionError ? (
            <p className="ga-product-detail__error">{actionError}</p>
          ) : null}

          <LocalCard className="ga-product-detail__tabs-card">
            <Tabs items={TABS} active={tab} onChange={setTab} />
            <div className="ga-product-detail__panel">
              {tab === 'overview' ? (
                <div className="ga-product-detail__stack">
                  <ProductInfoCard product={product} />
                  <ProductPackagingCard sku={primarySku} />
                  <ProductPricingPanel
                    sku={primarySku}
                    outerDiscountTiers={product.outerDiscountTiers}
                    canManage={canManageProducts}
                    onManageDiscounts={() => setEditOpen(true)}
                  />
                </div>
              ) : null}

              {tab === 'pricing' ? (
                <div className="ga-product-detail__stack">
                  <ProductPricingPanel
                    sku={primarySku}
                    outerDiscountTiers={product.outerDiscountTiers}
                    canManage={canManageProducts}
                    onManageDiscounts={() => setEditOpen(true)}
                  />
                  <ProductPriceHistoryTab rows={product.priceHistory} />
                </div>
              ) : null}

              {tab === 'inventory' ? (
                <div className="ga-product-detail__stack">
                  {product.inventoryOverview ? (
                    <ProductInventoryOverviewCard
                      overview={product.inventoryOverview}
                      sku={primarySku}
                      packagingHint={packagingHint}
                      warehouseRows={warehouseStock}
                      movementRows={product.inventoryMovements ?? []}
                      canManage={canManageProducts}
                      onUpdateStock={openAdjust}
                      showActivityPreview
                    />
                  ) : (
                    <p className="ga-product-detail__pending">
                      No stock recorded for this product yet.
                    </p>
                  )}
                  <ProductInventoryActivity
                    rows={product.inventoryMovements ?? []}
                  />
                </div>
              ) : null}

              {tab === 'packs' ? (
                <div className="ga-product-detail__stack">
                  <ProductSkusTab
                    productId={product.id}
                    productName={product.name}
                    productType={product.productType}
                    skus={product.skus}
                    canManage={canManageProducts}
                    onSkuCreatedWithoutPrice={(skuId) =>
                      navigate(`/pricing/${skuId}`)
                    }
                  />
                </div>
              ) : null}
            </div>
          </LocalCard>
        </div>

        <aside className="ga-product-detail__sidebar">
          <ProductWorkflowNextSteps
            product={product}
            onAddSku={() => setTab('packs')}
            onPublish={() => {
              updateProduct.mutate(
                { id: product.id, input: { isActive: true } },
                {
                  onError: (err) =>
                    setActionError(
                      formatMutationError(err, 'Publish failed'),
                    ),
                },
              );
            }}
            onEdit={() => setEditOpen(true)}
            publishPending={updateProduct.isPending}
            canManageProducts={canManageProducts}
            canManagePricing={canManagePricing}
          />
          <PublishChecklist
            items={product.checklist}
            canPublish={product.canPublish}
            publishStatus={product.publishStatus}
          />
        </aside>
      </div>

      {canManageProducts ? (
        <>
          <ProductFormModal
            open={editOpen}
            mode="edit"
            product={product}
            onClose={() => setEditOpen(false)}
          />
          <ProductStockAdjustModal
            open={adjustOpen}
            skuId={primarySku?.id}
            productName={product.name}
            preferredBalanceId={adjustBalanceId}
            onClose={() => {
              setAdjustOpen(false);
              setAdjustBalanceId(null);
            }}
          />
          <ProductDeleteArchiveModal
            open={deleteOpen}
            productId={product.id}
            productName={product.name}
            onClose={() => setDeleteOpen(false)}
          />
        </>
      ) : null}
    </div>
  );
}

function ProductDetailFallback({
  title,
  detail,
  onRetry,
  retrying,
}: {
  title: string;
  detail: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="ga-product-detail-fallback">
      <Link to="/products" className="ga-product-detail-fallback__back">
        ← Back to Products
      </Link>
      <Card>
        <EmptyState title={title} detail={detail} />
        {onRetry ? (
          <div className="ga-product-detail-fallback__actions">
            <Button variant="primary" onClick={onRetry} disabled={retrying}>
              {retrying ? 'Retrying…' : 'Retry'}
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
