import type { SalesmanPerformanceRow } from '@/data/dashboard-types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';

type Props = {
  rows: SalesmanPerformanceRow[];
};

export function SalesTeamPerformance({ rows }: Props) {
  return (
    <Card title="Sales Team Performance">
      {rows.length === 0 ? (
        <EmptyState
          title="No salesman activity"
          detail="Daily sales performance will load here."
        />
      ) : (
        <div className="ga-table-wrap">
          <table className="ga-table">
            <thead>
              <tr>
                <th>Salesman</th>
                <th>Orders</th>
                <th>Revenue</th>
                <th>Collections</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className="ga-table__primary">{row.name}</span>
                  </td>
                  <td>{row.ordersToday}</td>
                  <td>{row.revenueLabel}</td>
                  <td>{row.collectionsLabel}</td>
                  <td>
                    <Badge tone={row.status === 'active' ? 'success' : 'neutral'}>
                      {row.status}
                    </Badge>
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
