import { Link } from 'react-router-dom';
import type { SkuPriceListRow } from '@/data/pricing-types';
import { PriceStatusBadge } from '@/components/pricing/PriceStatusBadge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';
import './SkuPriceListTable.css';

type Props = {
  rows: readonly SkuPriceListRow[];
};

export function SkuPriceListTable({ rows }: Props) {
  return (
    <Card title="SKU Price List">
      {rows.length === 0 ? (
        <EmptyState
          title="No SKUs"
          detail="Wholesale SKU trade prices will appear here."
        />
      ) : (
        <div className="ga-table-wrap">
          <table className="ga-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Customer Price</th>
                <th>Reference</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link
                      to={`/pricing/${row.skuId}`}
                      className="ga-table__primary ga-price-link"
                    >
                      <span>{row.skuName}</span>
                      <span className="ga-table__mono ga-price-link__code">
                        {row.skuCode}
                      </span>
                    </Link>
                  </td>
                  <td>{row.productName}</td>
                  <td>{row.currentPriceLabel}</td>
                  <td>{row.unitPriceLabel ?? '—'}</td>
                  <td>
                    <PriceStatusBadge status={row.status} />
                  </td>
                  <td>{row.updatedAtLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
