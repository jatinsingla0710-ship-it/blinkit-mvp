import { Link } from 'react-router-dom';
import type { LowStockItem } from '@/data/dashboard-types';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';

type Props = {
  items: LowStockItem[];
};

/** Compact low-stock list — deep-links into Inventory filters. */
export function LowStockCard({ items }: Props) {
  return (
    <Card
      title="Low Stock"
      className="ga-low-stock-card"
      action={
        <Link to="/inventory?status=low" className="ga-low-stock-card__link">
          View all
        </Link>
      }
    >
      {items.length === 0 ? (
        <EmptyState
          title="No low-stock SKUs"
          detail="Items under the 10-pack threshold appear here."
        />
      ) : (
        <div className="ga-table-wrap">
          <table className="ga-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Code</th>
                <th>Available</th>
                <th>Threshold</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link
                      to={`/inventory/${item.id}`}
                      className="ga-table__primary"
                    >
                      {item.skuName}
                    </Link>
                  </td>
                  <td className="ga-table__mono">{item.skuCode}</td>
                  <td>
                    {item.available} {item.unit}
                  </td>
                  <td>
                    {item.threshold} {item.unit}
                  </td>
                  <td>
                    <Link to="/purchases">Purchase</Link>
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
