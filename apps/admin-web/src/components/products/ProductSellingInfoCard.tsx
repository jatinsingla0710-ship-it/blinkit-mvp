import { formatPackLabel } from '@/data/pack-units';
import {
  minimumOrderSummary,
  packUnitPluralLabel,
} from '@/data/pack-units';
import { formatInr } from '@groaurum/catalogue-display';
import type { ProductSkuRow } from '@/data/product-types';
import { Card } from '@/components/ui/Card';
import './ProductSellingInfoCard.css';

type Props = {
  sku?: ProductSkuRow;
};

export function ProductSellingInfoCard({ sku }: Props) {
  if (!sku) {
    return (
      <Card title="Product & Selling Information">
        <p className="ga-selling-info__empty">No SKU configured.</p>
      </Card>
    );
  }

  const packLabel =
    sku.netQuantity && sku.netQuantityUnit
      ? formatPackLabel(sku.netQuantity, sku.netQuantityUnit)
      : sku.name;

  const packWord = packUnitPluralLabel(sku.netQuantityUnit, sku.moq);
  const moqLabel = minimumOrderSummary({
    moq: sku.moq,
    packQuantity: sku.netQuantity ?? 1,
    packUnit: sku.netQuantityUnit,
    packsPerOuter: sku.packsPerCarton,
    outerType: sku.outerType,
  });

  return (
    <Card title="Product & Selling Information" className="ga-selling-info">
      <dl className="ga-selling-info__grid">
        <div>
          <dt>Selling Pack</dt>
          <dd>{packLabel}</dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd>
            {sku.currentTradePrice != null
              ? `${formatInr(sku.currentTradePrice)} per ${packUnitPluralLabel(sku.netQuantityUnit, 1)}`
              : sku.currentTradePriceLabel}
          </dd>
        </div>
        <div>
          <dt>Minimum Order</dt>
          <dd>{moqLabel.replace(/^Minimum order: /i, '')}</dd>
        </div>
        <div>
          <dt>SKU</dt>
          <dd className="ga-table__mono">{sku.skuCode}</dd>
        </div>
      </dl>
      <p className="ga-selling-info__hint">
        Customers order in {packWord}. Stock is tracked in the same units.
      </p>
    </Card>
  );
}
