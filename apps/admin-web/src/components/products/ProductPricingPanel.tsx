import { useMemo } from 'react';
import {
  buildPackContainerPricing,
  buildPackagingSummary,
  formatInr,
} from '@groaurum/catalogue-display';
import {
  OUTER_PACKAGES,
  formatPackLabel,
  type OuterPackageKey,
} from '@/data/pack-units';
import type { OuterDiscountTierRow, ProductSkuRow } from '@/data/product-types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import './ProductPricingPanel.css';

type Props = {
  sku?: ProductSkuRow;
  outerDiscountTiers?: OuterDiscountTierRow[];
  canManage?: boolean;
  onManageDiscounts?: () => void;
  /** When true, focus only on discount tiers (Discounts tab). */
  discountsOnly?: boolean;
};

export function ProductPricingPanel({
  sku,
  outerDiscountTiers = [],
  canManage = false,
  onManageDiscounts,
  discountsOnly = false,
}: Props) {
  const basePrice = sku?.currentTradePrice;
  const packLabel =
    sku?.netQuantity && sku?.netQuantityUnit
      ? formatPackLabel(sku.netQuantity, sku.netQuantityUnit)
      : 'Pack';

  const pricing = useMemo(() => {
    if (!sku || basePrice == null) return null;
    const result = buildPackContainerPricing({
      regularPackPrice: basePrice,
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
    return 'error' in result ? null : result;
  }, [sku, basePrice]);

  const packaging = useMemo(() => {
    if (!sku?.netQuantity || !sku.netQuantityUnit) return null;
    return buildPackagingSummary({
      netQuantity: sku.netQuantity,
      netQuantityUnit: sku.netQuantityUnit,
      packsPerOuter: sku.packsPerCarton,
      outerType: sku.outerType,
    });
  }, [sku]);

  if (!sku) {
    return (
      <Card title={discountsOnly ? 'Bulk Discounts' : 'Pricing'}>
        <p className="ga-product-pricing__empty">
          Add a SKU to configure pricing.
        </p>
      </Card>
    );
  }

  const outerKey = (sku.outerType ?? 'bag') as OuterPackageKey;
  const outerLabel = OUTER_PACKAGES[outerKey]?.label ?? 'Container';
  const outerPlural = OUTER_PACKAGES[outerKey]?.plural ?? 'containers';
  const hasOuter =
    sku.packsPerCarton != null && sku.packsPerCarton > 0 && pricing != null;

  const sortedTiers = [...outerDiscountTiers].sort(
    (a, b) => a.minOuterQuantity - b.minOuterQuantity,
  );

  if (discountsOnly) {
    return (
      <Card
        title="Bulk Discounts"
        className="ga-product-pricing"
        action={
          canManage && onManageDiscounts ? (
            <Button variant="secondary" onClick={onManageDiscounts}>
              Manage Discounts
            </Button>
          ) : undefined
        }
      >
        {!hasOuter ? (
          <p className="ga-product-pricing__empty">
            Quantity discounts apply to outer packs (Bag / Box / Carton). Configure
            outer packaging first.
          </p>
        ) : (
          <>
            <p className="ga-product-pricing__lead">
              Buy more {outerPlural} and save on each {outerLabel.toLowerCase()}.
              {pricing?.containerRegularPrice != null
                ? ` Regular price: ${formatInr(pricing.containerRegularPrice)} per ${outerLabel}.`
                : ''}
            </p>
            {sortedTiers.length > 0 ? (
              <table className="ga-product-pricing__table">
                <thead>
                  <tr>
                    <th>Buy Quantity</th>
                    <th>Discount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      1–
                      {sortedTiers[0].minOuterQuantity - 1} {outerPlural}
                    </td>
                    <td>Regular price</td>
                  </tr>
                  {sortedTiers.map((tier, index) => {
                    const next = sortedTiers[index + 1];
                    const range = next
                      ? `${tier.minOuterQuantity}–${next.minOuterQuantity - 1} ${outerPlural}`
                      : `${tier.minOuterQuantity}+ ${outerPlural}`;
                    return (
                      <tr key={tier.id}>
                        <td>{range}</td>
                        <td>
                          {formatInr(tier.discountPerOuterUnit)} off per{' '}
                          {outerLabel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="ga-product-pricing__empty">
                No bulk discounts yet. Add tiers so customers save when they buy
                more {outerPlural}.
              </p>
            )}
            {sortedTiers.length > 0 ? (
              <ul className="ga-product-pricing__offer-chips">
                {sortedTiers.map((tier) => (
                  <li key={tier.id}>
                    Buy {tier.minOuterQuantity}+ {outerPlural} → Save{' '}
                    {formatInr(tier.discountPerOuterUnit)} per {outerLabel}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </Card>
    );
  }

  return (
    <Card
      title="Pricing"
      className="ga-product-pricing"
      action={
        canManage && onManageDiscounts ? (
          <Button variant="secondary" onClick={onManageDiscounts}>
            Edit Pricing
          </Button>
        ) : undefined
      }
    >
      {basePrice == null || !pricing ? (
        <p className="ga-product-pricing__empty">No selling price set yet.</p>
      ) : (
        <>
          <p className="ga-product-pricing__lead">
            What customers pay for each selling unit.
          </p>

          <table className="ga-product-pricing__table">
            <thead>
              <tr>
                <th>Unit</th>
                <th>Quantity</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1 Pack</td>
                <td>{packLabel}</td>
                <td>
                  <strong>{formatInr(pricing.packFinalPrice)}</strong>
                </td>
              </tr>
              {hasOuter && pricing.containerRegularPrice != null ? (
                <tr>
                  <td>1 {outerLabel}</td>
                  <td>
                    {sku.packsPerCarton} Packs
                    {packaging?.weightPerOuterLabel
                      ? ` / ${packaging.weightPerOuterLabel}`
                      : ''}
                  </td>
                  <td>
                    <strong>
                      {formatInr(pricing.containerRegularPrice)}
                    </strong>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          {hasOuter ? (
            <p className="ga-product-pricing__hint">
              1 {outerLabel} = {sku.packsPerCarton} × {packLabel}
              {pricing.containerRegularPrice != null
                ? ` · ${formatInr(pricing.packFinalPrice)} × ${sku.packsPerCarton} = ${formatInr(pricing.containerRegularPrice)}`
                : ''}
            </p>
          ) : (
            <p className="ga-product-pricing__hint">
              This product is sold by pack only — no outer packaging.
            </p>
          )}
        </>
      )}
    </Card>
  );
}
