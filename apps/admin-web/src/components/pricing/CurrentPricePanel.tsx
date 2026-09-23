import type { PriceRecordRow } from '@/data/pricing-types';
import { deriveUnitPrice } from '@/data/unit-price';
import { PriceStatusBadge } from '@/components/pricing/PriceStatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import './CurrentPricePanel.css';

type Props = {
  current: PriceRecordRow | null;
  sellingUnitLabel: string;
  netQuantity?: number;
  netQuantityUnit?: string;
};

export function CurrentPricePanel({
  current,
  sellingUnitLabel,
  netQuantity,
  netQuantityUnit,
}: Props) {
  if (!current) {
    return (
      <EmptyState
        title="No live price"
        detail="Set a trade price to make this SKU commercially ready."
      />
    );
  }

  const breakdown =
    current.tradePrice != null
      ? deriveUnitPrice({
          tradePrice: current.tradePrice,
          netQuantity,
          netQuantityUnit,
        })
      : null;

  return (
    <div className="ga-current-price">
      <div className="ga-current-price__hero">
        <p className="ga-current-price__label">Customer pack price</p>
        <p className="ga-current-price__value">
          {breakdown?.packTradePriceLabel ?? current.tradePriceLabel}
          {!breakdown ? (
            <span className="ga-current-price__unit"> / {sellingUnitLabel}</span>
          ) : null}
        </p>
        {breakdown ? (
          <p className="ga-current-price__unit-equiv">
            Reference: {breakdown.unitPriceLabel}
          </p>
        ) : null}
        <div className="ga-current-price__badge">
          <PriceStatusBadge status={current.status} />
        </div>
      </div>
      <dl className="ga-current-price__meta">
        <div>
          <dt>Effective from</dt>
          <dd>{current.effectiveFromLabel}</dd>
        </div>
        <div>
          <dt>Effective to</dt>
          <dd>{current.effectiveToLabel ?? 'Open (live)'}</dd>
        </div>
        <div>
          <dt>Recorded</dt>
          <dd>{current.createdAtLabel}</dd>
        </div>
        <div>
          <dt>Recorded by</dt>
          <dd>{current.createdByLabel}</dd>
        </div>
      </dl>
      <p className="ga-current-price__footnote">
        Live price is the latest effective append-only record. Prior values remain
        in Price History and are never overwritten.
      </p>
    </div>
  );
}
