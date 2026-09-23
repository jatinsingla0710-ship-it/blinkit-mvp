import { useMemo } from 'react';
import { formatInr, buildPackContainerPricing } from '@groaurum/catalogue-display';
import {
  OUTER_PACKAGES,
  type OuterPackageKey,
} from '@/data/pack-units';
import type { ProductDetail, ProductSkuRow } from '@/data/product-types';
import {
  InventoryStatusBadge,
} from '@/components/products/ProductStatusBadges';
import './ProductSummaryCards.css';

type Props = {
  product: ProductDetail;
  sku?: ProductSkuRow;
};

export function ProductSummaryCards({ product, sku }: Props) {
  const sellingPrice = useMemo(() => {
    if (!sku?.currentTradePrice) return product.currentTradePriceLabel;
    const result = buildPackContainerPricing({
      regularPackPrice: sku.currentTradePrice,
      packsPerOuter: sku.packsPerCarton,
      config: {
        packDiscountType: 'none',
        packDiscountValue: 0,
        containerPriceMode: sku.containerPriceMode,
        containerCustomPrice: sku.containerCustomPrice,
        containerDiscountType: 'none',
        containerDiscountValue: 0,
      },
    });
    if ('error' in result) return formatInr(sku.currentTradePrice);
    const outerKey = (sku.outerType ?? 'bag') as OuterPackageKey;
    const outerLabel = OUTER_PACKAGES[outerKey]?.label ?? 'Unit';
    if (result.containerRegularPrice != null && sku.packsPerCarton) {
      return `${formatInr(result.containerRegularPrice)} / ${outerLabel}`;
    }
    return `${formatInr(result.packFinalPrice)} / Pack`;
  }, [sku, product.currentTradePriceLabel]);

  const stockLabel =
    product.inventoryOverview?.mixedSummary ??
    product.inventoryOverview?.totalAvailableLabel ??
    '—';

  const offerCount = product.outerDiscountTiers?.length ?? 0;

  return (
    <div className="ga-product-summary" role="group" aria-label="Product summary">
      <article className="ga-product-summary__card">
        <p className="ga-product-summary__label">Selling Price</p>
        <p className="ga-product-summary__value">{sellingPrice}</p>
      </article>

      <article className="ga-product-summary__card">
        <p className="ga-product-summary__label">Stock</p>
        <p className="ga-product-summary__value">{stockLabel}</p>
        <div className="ga-product-summary__badge">
          <InventoryStatusBadge status={product.inventoryStatus} />
        </div>
      </article>

      <article className="ga-product-summary__card">
        <p className="ga-product-summary__label">Offers</p>
        <p className="ga-product-summary__value">
          {offerCount > 0
            ? `${offerCount} Active Tier${offerCount === 1 ? '' : 's'}`
            : 'No offers'}
        </p>
      </article>

      <article className="ga-product-summary__card">
        <p className="ga-product-summary__label">Category</p>
        <p className="ga-product-summary__value">{product.categoryName}</p>
      </article>
    </div>
  );
}
