import { useMemo, useState } from 'react';
import type { CatalogueSkuRow, OrderPreviewLine } from '@groaurum/api-client';
import { Button, TextField } from '@groaurum/ui';
import { ProductThumb } from '@/components/order/ProductThumb';
import { QuantityStepper } from '@/components/order/QuantityStepper';
import type { OrderDraftLine } from '@/data/order-draft';
import {
  displayUnitPrice,
  formatOrderQuantity,
  maxOrderQuantity,
  minOrderQuantity,
  orderRulesLabel,
  outerBreakdownLabel,
  packInfoLabel,
  toOrderUnits,
} from '@/data/order-quantity';
import { formatMoney } from '@/lib/money';

export function filterCatalogue(
  rows: readonly CatalogueSkuRow[],
  search: string,
): CatalogueSkuRow[] {
  const q = search.trim().toLowerCase();
  if (!q) return [...rows];
  return rows.filter((row) =>
    [row.product.name, row.sku.name, row.sku.skuCode, row.category?.name]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q)),
  );
}

type Props = {
  rows: readonly CatalogueSkuRow[];
  lines: readonly OrderDraftLine[];
  /** Server preview lines for the current cart only. */
  previewBySku: ReadonlyMap<string, OrderPreviewLine>;
  disabled: boolean;
  onChange: (skuId: string, quantity: number) => void;
  onAdjusted: (message: string) => void;
};

export function CatalogueList({
  rows,
  lines,
  previewBySku,
  disabled,
  onChange,
  onAdjusted,
}: Props) {
  const [search, setSearch] = useState('');
  const visible = useMemo(() => filterCatalogue(rows, search), [rows, search]);
  const qtyBySku = useMemo(
    () => new Map(lines.map((l) => [l.skuId, l.quantity])),
    [lines],
  );

  return (
    <div className="ga-sales-stack">
      <TextField
        label="Search products"
        name="product-search"
        type="search"
        placeholder="Product name or SKU code"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoComplete="off"
        grow
      />

      {visible.length === 0 ? (
        <p className="ga-sales-muted" role="status">
          No product matches “{search.trim()}”.
        </p>
      ) : null}

      <ul className="ga-sales-catalogue" aria-label="Products">
        {visible.map((row) => {
          const qty = qtyBySku.get(row.sku.id) ?? 0;
          const max = maxOrderQuantity(row.sku, row.availableQuantity);
          const outOfStock = row.availableQuantity <= 0;
          const cannotCoverMin = !outOfStock && max === 0;
          const packInfo = packInfoLabel(row.sku);
          const preview = qty > 0 ? previewBySku.get(row.sku.id) : undefined;
          const rules = orderRulesLabel(row.sku);
          const listPrice = displayUnitPrice(row.sku, row.unitPrice);
          const orderUnits = qty > 0 ? toOrderUnits(row.sku, qty) : 0;
          const breakdown = qty > 0 ? outerBreakdownLabel(row.sku, qty) : null;
          const previewUnitPrice =
            preview?.ok && preview.lineTotal != null && orderUnits > 0
              ? preview.lineTotal / orderUnits
              : listPrice.price;
          return (
            <li
              key={row.sku.id}
              className={['ga-sales-product', qty > 0 ? 'ga-sales-product--in-cart' : '']
                .filter(Boolean)
                .join(' ')}
            >
              <div className="ga-sales-product__head">
                <ProductThumb src={row.product.imageUrls[0]} name={row.product.name} />
                <div className="ga-sales-product__text">
                  <p className="ga-sales-list-item__title">{row.product.name}</p>
                  <p className="ga-sales-list-item__meta">
                    {row.sku.name}
                    {row.sku.specification ? ` · ${row.sku.specification}` : ''}
                  </p>
                  <p className="ga-sales-product__price">
                    {formatMoney(previewUnitPrice)}{' '}
                    <span className="ga-sales-muted">/ {listPrice.unitLabel}</span>
                  </p>
                  {packInfo ? <p className="ga-sales-list-item__meta">{packInfo}</p> : null}
                  {outOfStock ? (
                    <p className="ga-sales-product__stock ga-sales-product__stock--out">
                      Out of stock
                    </p>
                  ) : null}
                  {rules ? <p className="ga-sales-list-item__meta">{rules}</p> : null}
                </div>
              </div>

              <div className="ga-sales-product__controls">
                {qty === 0 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="ga-sales-btn-block"
                    disabled={disabled || max === 0}
                    aria-label={max === 0 ? undefined : `Add ${row.sku.name}`}
                    onClick={() => onChange(row.sku.id, minOrderQuantity(row.sku))}
                  >
                    {outOfStock ? 'Out of stock' : cannotCoverMin ? 'Not enough stock' : 'Add'}
                  </Button>
                ) : (
                  <>
                    <QuantityStepper
                      sku={row.sku}
                      quantity={qty}
                      available={row.availableQuantity}
                      disabled={disabled}
                      onChange={(next) => onChange(row.sku.id, next)}
                      onAdjusted={onAdjusted}
                    />
                    <p className="ga-sales-product__qty-note">
                      {formatOrderQuantity(row.sku, qty)}
                      {breakdown ? ` ${breakdown}` : ''}
                    </p>
                  </>
                )}
              </div>

              {preview && !preview.ok ? (
                <p className="ga-sales-error" role="alert">
                  {preview.message ?? 'This item cannot be ordered as entered.'}
                </p>
              ) : null}
              {preview?.ok && preview.lineTotal != null ? (
                <p className="ga-sales-product__line-total">
                  Line total <strong>{formatMoney(preview.lineTotal)}</strong>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
