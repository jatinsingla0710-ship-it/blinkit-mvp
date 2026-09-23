import { useState } from 'react';
import { Button } from '@groaurum/ui';
import type {
  InventoryMovementRow,
  ProductInventoryOverview,
  ProductSkuRow,
  ProductWarehouseStockRow,
} from '@/data/product-types';
import {
  OUTER_PACKAGES,
  packUnitPluralLabel,
  type OuterPackageKey,
} from '@/data/pack-units';
import { Card } from '@/components/ui/Card';
import { InventoryStatusBadge } from '@/components/products/ProductStatusBadges';
import './ProductInventoryOverview.css';

type OverviewProps = {
  overview: ProductInventoryOverview;
  sku?: ProductSkuRow;
  packagingHint?: string | null;
  warehouseRows?: ProductWarehouseStockRow[];
  movementRows?: InventoryMovementRow[];
  canManage?: boolean;
  onUpdateStock?: (balanceId?: string) => void;
  showActivityPreview?: boolean;
};

function statusHeadline(status: ProductInventoryOverview['status']): string {
  if (status === 'out_of_stock') return 'Out of Stock';
  if (status === 'low_stock') return 'Low Stock';
  if (status === 'in_stock') return 'Healthy';
  return 'Not Tracked';
}

export function ProductInventoryOverviewCard({
  overview,
  sku,
  packagingHint,
  warehouseRows = [],
  movementRows = [],
  canManage = false,
  onUpdateStock,
  showActivityPreview = false,
}: OverviewProps) {
  const [showDetails, setShowDetails] = useState(false);
  const packWord = packUnitPluralLabel(
    sku?.netQuantityUnit,
    overview.totalAvailablePacks,
  );
  const mixed =
    overview.mixedSummary ?? `${overview.totalAvailablePacks} ${packWord}`;

  const outerKey = (sku?.outerType ?? 'bag') as OuterPackageKey;
  const outerLabel = OUTER_PACKAGES[outerKey]?.label ?? 'Bag';
  const packsPerOuter = sku?.packsPerCarton;

  const weightLine = overview.equivalents.find((e) =>
    e.label.toLowerCase().includes('weight'),
  );

  const totalReserved = warehouseRows.reduce(
    (sum, row) => sum + row.reservedPacks,
    0,
  );

  return (
    <Card
      title="Inventory"
      className="ga-product-inv-overview"
      action={
        canManage && onUpdateStock ? (
          <Button variant="primary" onClick={() => onUpdateStock()}>
            Adjust Stock
          </Button>
        ) : undefined
      }
    >
      <section className="ga-product-inv-overview__total-block">
        <div className="ga-product-inv-overview__status-row">
          <InventoryStatusBadge status={overview.status} />
          <span
            className={`ga-product-inv-overview__tone ga-product-inv-overview__tone--${overview.statusTone}`}
          >
            {statusHeadline(overview.status)}
          </span>
        </div>

        <p className="ga-product-inv-overview__kicker">Total Stock</p>
        <p className="ga-product-inv-overview__mixed">{mixed}</p>

        <ul className="ga-product-inv-overview__equiv-simple">
          <li>
            = {overview.totalAvailablePacks} {packWord}
          </li>
          {weightLine ? <li>= {weightLine.label.replace(/^Total Weight:\s*/i, '')}</li> : null}
        </ul>

        {packagingHint ? (
          <p className="ga-product-inv-overview__pack-hint">
            Packaging · {packagingHint}
          </p>
        ) : null}

        {overview.status === 'low_stock' ? (
          <p className="ga-product-inv-overview__alert ga-product-inv-overview__alert--warn">
            Overall stock is running low — check warehouses below.
          </p>
        ) : null}
        {overview.status === 'out_of_stock' ? (
          <p className="ga-product-inv-overview__alert ga-product-inv-overview__alert--danger">
            No stock available across warehouses.
          </p>
        ) : null}
      </section>

      <section className="ga-product-inv-overview__warehouses">
        <h3>Stock by Warehouse</h3>
        {warehouseRows.length === 0 ? (
          <p className="ga-product-inv-overview__empty">
            No warehouse stock recorded yet. Use Adjust Stock to add inventory.
          </p>
        ) : (
          <div className="ga-product-inv-overview__wh-list">
            {warehouseRows.map((row) => (
              <article
                key={row.balanceId || `${row.locationId}-${row.skuCode}`}
                className="ga-product-inv-overview__wh-card"
              >
                <div className="ga-product-inv-overview__wh-head">
                  <InventoryStatusBadge status={row.inventoryStatus} />
                  <strong>{row.locationName}</strong>
                  <span className="ga-product-inv-overview__wh-status">
                    {statusHeadline(row.inventoryStatus)}
                  </span>
                </div>
                <p className="ga-product-inv-overview__wh-qty">
                  {row.mixedSummary || row.availableLabel}
                </p>
                <p className="ga-product-inv-overview__wh-meta">
                  {row.availablePacks} {packWord} available
                  {packsPerOuter
                    ? ` · Each ${outerLabel} contains ${packsPerOuter} Packs`
                    : ''}
                  {row.reservedPacks > 0
                    ? ` · ${row.reservedPacks} reserved`
                    : ''}
                </p>
                {canManage && onUpdateStock ? (
                  <button
                    type="button"
                    className="ga-product-inv-overview__wh-adjust"
                    onClick={() => onUpdateStock(row.balanceId)}
                  >
                    Adjust this warehouse
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        )}

        {warehouseRows.length > 0 ? (
          <p className="ga-product-inv-overview__company-total">
            Total across all warehouses:{' '}
            <strong>{mixed}</strong>
            {totalReserved > 0
              ? ` · ${totalReserved} ${packUnitPluralLabel(sku?.netQuantityUnit, totalReserved)} reserved`
              : ''}
          </p>
        ) : null}

        <p className="ga-product-inv-overview__threshold-hint">
          {packsPerOuter && packsPerOuter > 0
            ? `Low stock when this warehouse has fewer than 10 ${packWord} (about ${Math.max(1, Math.ceil(10 / packsPerOuter))} ${(OUTER_PACKAGES[outerKey]?.plural ?? 'outers').replace(/^./, (c) => c.toUpperCase())}).`
            : `Low stock when a warehouse has fewer than 10 ${packWord}.`}
        </p>
      </section>

      {showDetails ? (
        <section className="ga-product-inv-overview__detailed">
          <h3>Technical details</h3>
          <dl className="ga-product-inv-overview__totals">
            <div>
              <dt>Base packs on hand</dt>
              <dd>{overview.totalAvailablePacks}</dd>
            </div>
            {sku?.netQuantity && sku.netQuantityUnit ? (
              <div>
                <dt>Inner pack</dt>
                <dd>
                  {sku.netQuantity} {sku.netQuantityUnit}
                </dd>
              </div>
            ) : null}
            {packsPerOuter ? (
              <div>
                <dt>Packs per {outerLabel}</dt>
                <dd>{packsPerOuter}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      {showActivityPreview && movementRows.length > 0 ? (
        <section className="ga-product-inv-overview__movements">
          <h3>Recent activity</h3>
          <ul>
            {movementRows.slice(0, 4).map((row) => (
              <li key={row.id}>
                <strong>{row.typeLabel}</strong> — {row.quantityLabel}
                <span>
                  {row.locationLabel} · {row.atLabel}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="ga-product-inv-overview__toggle">
        <Button variant="ghost" onClick={() => setShowDetails((v) => !v)}>
          {showDetails ? 'Hide technical details' : 'Show technical details'}
        </Button>
      </div>
    </Card>
  );
}

/** @deprecated */
export function ProductWarehouseBreakdown() {
  return null;
}

const MOVEMENT_ICONS: Record<string, string> = {
  RECEIPT: '📦',
  ORDER_DISPATCH: '🛒',
  RETURN: '↩',
  DAMAGE: '⚠',
  ADMIN_ADJUSTMENT: '✎',
};

type ActivityProps = {
  rows: InventoryMovementRow[];
};

export function ProductInventoryActivity({ rows }: ActivityProps) {
  const recent = (rows ?? []).slice(0, 10);

  return (
    <Card title="Stock Activity" className="ga-product-inv-activity">
      {recent.length === 0 ? (
        <p className="ga-product-inv-activity__empty">
          No stock movements yet.
        </p>
      ) : (
        <ol className="ga-product-inv-activity__list">
          {recent.map((row) => (
            <li key={row.id}>
              <span className="ga-product-inv-activity__icon" aria-hidden>
                {MOVEMENT_ICONS[row.movementType ?? ''] ?? '•'}
              </span>
              <div>
                <strong>{row.typeLabel}</strong>
                <p>{row.quantityLabel}</p>
                <span className="ga-product-inv-activity__meta">
                  {row.locationLabel} · {row.atLabel}
                  {row.note ? ` · ${row.note}` : ''}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
