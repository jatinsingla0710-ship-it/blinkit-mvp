import type { LowStockItem } from '@/data/dashboard-types';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';

type Props = {
  items: LowStockItem[];
};

export function LowStockCard({ items }: Props) {
  return (
    <Card title="Low Stock">
      {items.length === 0 ? (
        <EmptyState
          title="No low-stock SKUs"
          detail="Inventory thresholds will appear here."
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
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className="ga-table__primary">{item.skuName}</span>
                  </td>
                  <td className="ga-table__mono">{item.skuCode}</td>
                  <td>
                    {item.available} {item.unit}
                  </td>
                  <td>
                    {item.threshold} {item.unit}
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
