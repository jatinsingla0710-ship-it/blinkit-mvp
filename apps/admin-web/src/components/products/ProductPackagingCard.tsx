import {
  buildPackagingSummary,
  buildPricingBreakdown,
  formatInr,
} from '@groaurum/catalogue-display';
import { formatPackLabel, OUTER_PACKAGES, type OuterPackageKey } from '@/data/pack-units';
import type { ProductSkuRow } from '@/data/product-types';
import { Card } from '@/components/ui/Card';
import './ProductPackagingCard.css';

type Props = {
  sku?: ProductSkuRow;
};

export function ProductPackagingCard({ sku }: Props) {
  if (!sku?.netQuantity || !sku.netQuantityUnit) {
    return (
      <Card title="Packaging" className="ga-product-packaging">
        <p className="ga-product-packaging__empty">
          No packaging configured for this product yet.
        </p>
      </Card>
    );
  }

  const packLabel = formatPackLabel(sku.netQuantity, sku.netQuantityUnit);
  const hasOuter = Boolean(sku.packsPerCarton && sku.packsPerCarton > 0);
  const outerKey = (sku.outerType ?? 'bag') as OuterPackageKey;
  const outerLabel = OUTER_PACKAGES[outerKey]?.label ?? 'Container';

  if (!hasOuter) {
    return (
      <Card title="Packaging" className="ga-product-packaging">
        <div className="ga-product-packaging__stack">
          <div className="ga-product-packaging__block">
            <span className="ga-product-packaging__kicker">Inner Pack</span>
            <strong>{packLabel}</strong>
          </div>
          <p className="ga-product-packaging__hint">
            Sold as individual packs — no outer packaging configured.
          </p>
        </div>
      </Card>
    );
  }

  const summary = buildPackagingSummary({
    netQuantity: sku.netQuantity,
    netQuantityUnit: sku.netQuantityUnit,
    packsPerOuter: sku.packsPerCarton,
    outerType: sku.outerType,
  });

  const pricing =
    sku.currentTradePrice != null
      ? buildPricingBreakdown({
          baseUnitPrice: sku.currentTradePrice,
          baseUnitLabel: summary.sellingUnitLabel,
          packsPerOuter: sku.packsPerCarton,
          outerUnitLabel: summary.outerUnitLabel,
        })
      : null;

  return (
    <Card title="Packaging" className="ga-product-packaging">
      <div className="ga-product-packaging__stack">
        <div className="ga-product-packaging__block">
          <span className="ga-product-packaging__kicker">Inner Pack</span>
          <strong>{packLabel}</strong>
        </div>
        <div className="ga-product-packaging__block">
          <span className="ga-product-packaging__kicker">Outer Packaging</span>
          <strong>{outerLabel}</strong>
        </div>
        <div className="ga-product-packaging__block">
          <span className="ga-product-packaging__kicker">
            Packs per {outerLabel}
          </span>
          <strong>{sku.packsPerCarton}</strong>
        </div>
        {summary.weightPerOuterLabel ? (
          <div className="ga-product-packaging__block">
            <span className="ga-product-packaging__kicker">
              Total per {outerLabel}
            </span>
            <strong>{summary.weightPerOuterLabel}</strong>
          </div>
        ) : null}
      </div>

      <ul className="ga-product-packaging__checks">
        <li>
          1 {outerLabel} = {sku.packsPerCarton} × {packLabel}
        </li>
        {pricing?.outerUnitPrice != null && sku.currentTradePrice != null ? (
          <li>
            {formatInr(sku.currentTradePrice)} × {sku.packsPerCarton} ={' '}
            {formatInr(pricing.outerUnitPrice)} per {outerLabel}
          </li>
        ) : null}
      </ul>
    </Card>
  );
}
