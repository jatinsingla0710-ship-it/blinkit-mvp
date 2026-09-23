import type { FormEvent } from 'react';
import type { SetPriceDraft } from '@/data/pricing-types';
import {
  packTradePriceFromBasis,
  priceBasesForPackUnit,
  priceBasisLabel,
} from '@/data/sku-pack-pricing';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import './SetPriceForm.css';

type Props = {
  draft: SetPriceDraft;
  onChange: (next: SetPriceDraft) => void;
  onSubmit?: (draft: SetPriceDraft) => void;
  disabled?: boolean;
  mode: 'set' | 'update';
  netQuantity?: number;
  netQuantityUnit?: string;
  sellingUnitLabel: string;
};

/**
 * Set / Update SKU price using a clear price basis (e.g. Per kg).
 * Stores the converted commercial pack trade price.
 */
export function SetPriceForm({
  draft,
  onChange,
  onSubmit,
  disabled = false,
  mode,
  netQuantity,
  netQuantityUnit,
  sellingUnitLabel,
}: Props) {
  const basisPrice = Number(draft.basisPrice);
  const packQuantity = Number(netQuantity);
  const packUnit = (netQuantityUnit ?? '').trim();
  const packLabel =
    Number.isFinite(packQuantity) && packQuantity > 0
      ? `${packQuantity} ${packUnit || 'unit'}`
      : null;

  const converted =
    Number.isFinite(basisPrice) &&
    basisPrice > 0 &&
    Number.isFinite(packQuantity) &&
    packQuantity > 0
      ? packTradePriceFromBasis({
          basisPrice,
          priceBasis: draft.priceBasis,
          packQuantity,
          packUnit,
        })
      : null;

  const basisOptions = priceBasesForPackUnit(packUnit);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit?.(draft);
  };

  const title = mode === 'update' ? 'Update Price' : 'Set Price';
  const submitLabel = mode === 'update' ? 'Update Price' : 'Set Price';

  return (
    <Card title={title}>
      <form className="ga-set-price-form" onSubmit={handleSubmit}>
        <p className="ga-set-price-form__hint">
          Enter price on a clear basis (for example Per kg). Customer pack price for{' '}
          {sellingUnitLabel}
          {packLabel ? ` (${packLabel})` : ''} is calculated automatically. Prior
          prices stay in history.
        </p>

        <label className="ga-set-price-form__field">
          <span>Price Basis</span>
          <select
            value={draft.priceBasis}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                ...draft,
                priceBasis: e.target.value as SetPriceDraft['priceBasis'],
              })
            }
          >
            {basisOptions.map((basis) => (
              <option key={basis} value={basis}>
                {priceBasisLabel(basis)}
              </option>
            ))}
          </select>
        </label>

        <label className="ga-set-price-form__field">
          <span>Price (₹)</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="e.g. 1000"
            value={draft.basisPrice}
            disabled={disabled}
            onChange={(e) => onChange({ ...draft, basisPrice: e.target.value })}
            required
          />
        </label>

        {converted && !('error' in converted) && packLabel ? (
          <div className="ga-set-price-form__unit">
            <p className="ga-set-price-form__unit-label">Customer pack price</p>
            <p className="ga-set-price-form__unit-value">
              ₹{converted.packTradePrice.toLocaleString('en-IN', {
                maximumFractionDigits: 2,
              })}{' '}
              / {packLabel} pack
            </p>
            <p className="ga-set-price-form__unit-calc">
              {priceBasisLabel(draft.priceBasis)} ₹{basisPrice.toLocaleString('en-IN')} →
              pack price above (stored as trade price)
            </p>
          </div>
        ) : converted && 'error' in converted ? (
          <p className="ga-set-price-form__hint ga-set-price-form__error">
            {converted.error}
          </p>
        ) : (
          <p className="ga-set-price-form__hint">
            Pack size is required on the SKU to convert a basis price into the
            customer pack price.
          </p>
        )}

        <Button type="submit" variant="primary" disabled={disabled}>
          {submitLabel}
        </Button>
      </form>
    </Card>
  );
}
