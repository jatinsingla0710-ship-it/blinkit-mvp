import { Link } from 'react-router-dom';
import type { ProductListRow } from '@/data/product-types';
import {
  InventoryStatusBadge,
  PublishStatusBadge,
} from '@/components/products/ProductStatusBadges';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';
import './ProductListTable.css';

type Props = {
  rows: readonly ProductListRow[];
};

function packagingLines(label: string | undefined): string[] {
  if (!label) return [];
  return label.split('\n').filter(Boolean);
}

export function ProductListTable({ rows }: Props) {
  return (
    <Card className="ga-product-list-card">
      {rows.length === 0 ? (
        <EmptyState
          title="No products match"
          detail="Try a different search or filter."
        />
      ) : (
        <div className="ga-table-wrap">
          <table className="ga-table ga-product-list-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Packaging</th>
                <th>Inventory</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const packLines = packagingLines(row.packagingLabel);
                return (
                  <tr key={row.id}>
                    <td>
                      <div className="ga-product-list-table__product">
                        {row.imageUrl ? (
                          <img
                            src={row.imageUrl}
                            alt=""
                            className="ga-product-list-table__thumb"
                          />
                        ) : (
                          <span
                            className="ga-product-list-table__thumb ga-product-list-table__thumb--placeholder"
                            aria-hidden
                          />
                        )}
                        <div>
                          <Link
                            to={`/products/${row.id}`}
                            className="ga-table__primary ga-product-link"
                          >
                            {row.name}
                          </Link>
                          {packLines[0] ? (
                            <span className="ga-product-list-table__sub">
                              {packLines[0]}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="ga-table__mono">
                      {row.primarySkuCode ?? '—'}
                    </td>
                    <td>{row.categoryName}</td>
                    <td className="ga-product-list-table__packaging">
                      {packLines.length > 1
                        ? packLines.slice(1).join(' · ')
                        : packLines[0] ?? '—'}
                    </td>
                    <td>
                      <span className="ga-product-list-table__stock">
                        {row.availableStockLabel ?? '—'}
                      </span>
                    </td>
                    <td>
                      <InventoryStatusBadge status={row.inventoryStatus} />
                      <span className="ga-product-list-table__publish">
                        <PublishStatusBadge status={row.publishStatus} />
                      </span>
                    </td>
                    <td className="ga-product-list-table__action-cell">
                      <Link
                        to={`/products/${row.id}`}
                        className="ga-product-list-table__action"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
