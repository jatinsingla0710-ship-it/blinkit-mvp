import { Link } from 'react-router-dom';
import type { InventoryListRow } from '@/data/inventory-types';
import { inventoryDetailPath } from '@/data/inventory-detail-key';
import { InventoryStatusBadge } from '@/components/inventory/InventoryStatusBadge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';
import './InventoryTable.css';

type Props = {
  rows: readonly InventoryListRow[];
};

export function InventoryTable({ rows }: Props) {
  return (
    <Card title="Stock by Product" className="ga-inv-table-card">
      {rows.length === 0 ? (
        <EmptyState
          title="No inventory found"
          detail="Stock positions will appear here once warehouse balances exist."
        />
      ) : (
        <div className="ga-table-wrap">
          <table className="ga-table ga-inv-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Total Stock</th>
                <th>Packaging</th>
                <th>Warehouses</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="ga-inv-table__product">
                      <div className="ga-inv-table__thumb" aria-hidden>
                        {row.imageUrl ? (
                          <img src={row.imageUrl} alt="" />
                        ) : (
                          <span>{row.productName.slice(0, 1)}</span>
                        )}
                      </div>
                      <div>
                        <Link
                          to={inventoryDetailPath(row.skuId)}
                          className="ga-table__primary ga-inv-link"
                        >
                          {row.productName}
                        </Link>
                        <span className="ga-inv-table__sku-name">
                          {row.skuName}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="ga-table__mono">{row.skuCode}</span>
                  </td>
                  <td>{row.categoryName}</td>
                  <td>
                    <strong className="ga-inv-table__stock">
                      {row.mixedStockLabel}
                    </strong>
                    <span className="ga-inv-table__stock-sub">
                      {row.packsTotalLabel}
                      {row.weightTotalLabel
                        ? ` · ${row.weightTotalLabel}`
                        : ''}
                    </span>
                  </td>
                  <td>
                    <span className="ga-inv-table__packaging">
                      {row.packagingLabel}
                    </span>
                  </td>
                  <td>
                    <ul className="ga-inv-table__wh">
                      {row.warehouses.slice(0, 3).map((wh) => (
                        <li key={wh.balanceId}>
                          <span>{wh.warehouseName}</span>
                          <strong>{wh.mixedStockLabel}</strong>
                        </li>
                      ))}
                      {row.warehouseCount > 3 ? (
                        <li className="ga-inv-table__wh-more">
                          +{row.warehouseCount - 3} more
                        </li>
                      ) : null}
                    </ul>
                  </td>
                  <td>
                    <InventoryStatusBadge status={row.status} />
                  </td>
                  <td>
                    <Link
                      to={inventoryDetailPath(row.skuId)}
                      className="ga-inv-table__action"
                    >
                      Manage stock
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
