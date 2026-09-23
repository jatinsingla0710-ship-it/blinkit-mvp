import type { InventorySkuDetail } from '@/data/inventory-types';
import { InventoryStatusBadge } from '@/components/inventory/InventoryStatusBadge';
import { inventoryStatusHeadline } from '@/data/inventory-display';
import './InventoryOverviewTab.css';

type Props = {
  detail: InventorySkuDetail;
  onSelectWarehouse?: (balanceId: string) => void;
};

export function InventoryOverviewTab({ detail, onSelectWarehouse }: Props) {
  return (
    <div className="ga-inv-overview">
      <section className="ga-inv-overview__total">
        <p className="ga-inv-overview__kicker">Total Available Stock</p>
        <div className="ga-inv-overview__total-head">
          <InventoryStatusBadge status={detail.overallStatus} />
          <span>{inventoryStatusHeadline(detail.overallStatus)}</span>
        </div>
        <p className="ga-inv-overview__total-qty">{detail.totalMixedStockLabel}</p>
        <ul className="ga-inv-overview__total-meta">
          <li>{detail.totalPacksLabel}</li>
          {detail.totalWeightLabel ? <li>{detail.totalWeightLabel}</li> : null}
        </ul>
        {detail.packagingLabel ? (
          <p className="ga-inv-overview__packaging">
            Packaging · {detail.packagingLabel}
          </p>
        ) : null}
        {detail.overallStatus === 'low' ? (
          <p className="ga-inv-overview__warn" role="status">
            Low Stock — only {detail.totalMixedStockLabel} remaining across
            warehouses.
          </p>
        ) : null}
        {detail.overallStatus === 'out_of_stock' ? (
          <p className="ga-inv-overview__danger" role="status">
            Out of Stock — no available quantity in any warehouse.
          </p>
        ) : null}
      </section>

      <section className="ga-inv-overview__warehouses">
        <h3>Stock by Warehouse</h3>
        <div className="ga-inv-overview__wh-grid">
          {detail.warehouses.map((wh) => {
            const selected = wh.balanceId === detail.balanceId;
            return (
              <button
                key={wh.balanceId}
                type="button"
                className={
                  selected
                    ? 'ga-inv-overview__wh-card ga-inv-overview__wh-card--selected'
                    : 'ga-inv-overview__wh-card'
                }
                onClick={() => onSelectWarehouse?.(wh.balanceId)}
              >
                <div className="ga-inv-overview__wh-head">
                  <strong>
                    {wh.warehouseName}
                    {!wh.warehouseActive ? ' (inactive)' : ''}
                  </strong>
                  <InventoryStatusBadge status={wh.status} />
                </div>
                <dl className="ga-inv-overview__wh-stats">
                  <div>
                    <dt>Available</dt>
                    <dd>{wh.mixedAvailableLabel}</dd>
                  </div>
                  <div>
                    <dt>Reserved</dt>
                    <dd>{wh.mixedReservedLabel}</dd>
                  </div>
                  <div>
                    <dt>On hand</dt>
                    <dd>{wh.mixedOnHandLabel}</dd>
                  </div>
                </dl>
                <p className="ga-inv-overview__wh-packs">{wh.packsTotalLabel}</p>
                <p className="ga-inv-overview__wh-status">
                  Status: {inventoryStatusHeadline(wh.status)}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <p className="ga-inv-overview__footnote">
        Each warehouse keeps its own balance. Adjustments apply only to the
        selected warehouse.
      </p>
    </div>
  );
}
