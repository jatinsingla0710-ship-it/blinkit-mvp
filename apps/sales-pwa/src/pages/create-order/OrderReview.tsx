import type {
  CatalogueSkuRow,
  SalesmanOrderPreview,
  SalesmanRetailer,
} from '@groaurum/api-client';
import { Button, Card, TextField } from '@groaurum/ui';
import { ButtonLink } from '@/components/ButtonLink';
import {
  outerBreakdownLabel,
  sellingQuantityLabel,
} from '@/data/order-quantity';
import type { SubmitFailure } from '@/data/order-submit';
import { formatMoney } from '@/lib/money';

type Props = {
  shop: SalesmanRetailer;
  reviewed: SalesmanOrderPreview;
  rowsBySku: ReadonlyMap<string, CatalogueSkuRow>;
  notes: string;
  onNotesChange: (notes: string) => void;
  submitting: boolean;
  online: boolean;
  failure: SubmitFailure | null;
  pricesChanged: boolean;
  onSubmit: () => void;
  onEdit: () => void;
};

export function OrderReview({
  shop,
  reviewed,
  rowsBySku,
  notes,
  onNotesChange,
  submitting,
  online,
  failure,
  pricesChanged,
  onSubmit,
  onEdit,
}: Props) {
  const uncertain = failure?.kind === 'uncertain';
  const submitDisabled = submitting || !online || uncertain || !reviewed.allValid;

  return (
    <div className="ga-sales-stack">
      <Card title="Customer">
        <p className="ga-sales-list-item__title">{shop.tradeName}</p>
        <p className="ga-sales-list-item__meta">
          {shop.areaLabel} · {shop.addressLine}, {shop.city} {shop.pinCode}
        </p>
      </Card>

      <Card title={`Items (${reviewed.lines.length})`}>
        <ul className="ga-sales-lines">
          {reviewed.lines.map((line) => {
            const row = rowsBySku.get(line.skuId);
            const breakdown = row ? outerBreakdownLabel(row.sku, line.quantity) : null;
            return (
              <li key={line.skuId} className="ga-sales-line">
                <div className="ga-sales-line__main">
                  <p className="ga-sales-line__title">{row?.product.name ?? 'Product'}</p>
                  <p className="ga-sales-list-item__meta">
                    {row ? `${row.sku.name} · ${row.sku.skuCode}` : line.skuId}
                  </p>
                  <p className="ga-sales-list-item__meta">
                    {row ? sellingQuantityLabel(row.sku, line.quantity) : line.quantity}
                    {breakdown ? ` ${breakdown}` : ''}
                    {line.unitPrice != null ? ` × ${formatMoney(line.unitPrice)}` : ''}
                  </p>
                </div>
                <span className="ga-sales-line__total">
                  {line.lineTotal != null ? formatMoney(line.lineTotal) : '—'}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="ga-sales-total-row">
          <span>Order total</span>
          <span className="ga-sales-amount ga-sales-amount--lg">{formatMoney(reviewed.total)}</span>
        </div>
        <p className="ga-sales-muted">
          Prices from the server, including bag/carton pricing and quantity discounts.
        </p>
      </Card>

      <TextField
        label="Note for this order (optional)"
        name="notes"
        value={notes}
        maxLength={500}
        onChange={(e) => onNotesChange(e.target.value)}
        disabled={submitting}
        grow
      />

      {pricesChanged ? (
        <p className="ga-sales-warning" role="alert">
          Prices or stock changed since you opened this review. Check the new total above,
          then submit again.
        </p>
      ) : null}

      {failure?.kind === 'rejected' ? (
        <p className="ga-sales-error" role="alert">
          Order not placed: {failure.message}
        </p>
      ) : null}

      {uncertain ? (
        <div className="ga-sales-warning ga-sales-stack" role="alert">
          <p className="ga-sales-summary__warn">We couldn’t confirm whether this order was placed.</p>
          <p>
            The connection dropped before the server answered. Open Order history and check for
            this order before trying again, so it is not placed twice. Your draft is still saved.
          </p>
          <ButtonLink to="/orders?tab=pending" variant="primary" block>
            Check order history
          </ButtonLink>
        </div>
      ) : null}

      {!online ? (
        <p className="ga-sales-warning" role="status">
          You are offline. Your draft is saved; submit when you are back online.
        </p>
      ) : null}

      <div className="ga-sales-review-actions">
        <Button
          type="button"
          variant="primary"
          className="ga-sales-btn-block ga-sales-btn-lg"
          disabled={submitDisabled}
          onClick={onSubmit}
          aria-busy={submitting || undefined}
        >
          {submitting ? 'Submitting…' : `Submit order · ${formatMoney(reviewed.total)}`}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="ga-sales-btn-block"
          disabled={submitting}
          onClick={onEdit}
        >
          Edit items
        </Button>
      </div>
    </div>
  );
}
