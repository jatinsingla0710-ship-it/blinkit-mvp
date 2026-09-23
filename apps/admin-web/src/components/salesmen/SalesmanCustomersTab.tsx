import { Link } from 'react-router-dom';
import type { SalesmanAssignedCustomer } from '@/data/salesmen-types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';
import './SalesmanCustomersTab.css';

type Props = {
  rows: SalesmanAssignedCustomer[];
  onCreateOrder?: (customerId: string) => void;
  onReassign?: (customerId: string) => void;
};

export function SalesmanCustomersTab({
  rows,
  onCreateOrder,
  onReassign,
}: Props) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No assigned customers"
        detail="Retail coverage for this salesman will appear here."
      />
    );
  }

  return (
    <div className="ga-table-wrap">
      <table className="ga-table">
        <thead>
          <tr>
            <th>Shop Name</th>
            <th>Area</th>
            <th>Status</th>
            <th>Last Order</th>
            <th>Last Visit</th>
            <th>Activation Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link
                  to={`/customers/${row.id}`}
                  className="ga-table__primary ga-sm-cust-link"
                >
                  {row.shopName}
                </Link>
              </td>
              <td>{row.areaLabel}</td>
              <td>
                <Badge tone="neutral">{row.accountStatusLabel}</Badge>
              </td>
              <td>{row.lastOrderLabel}</td>
              <td>{row.lastVisitLabel}</td>
              <td>
                <Badge
                  tone={
                    row.activationStatus === 'activated' ? 'success' : 'warning'
                  }
                >
                  {row.activationLabel}
                </Badge>
              </td>
              <td>
                <div className="ga-sm-cust-actions">
                  <Link to={`/customers/${row.id}`} className="ga-sm-cust-link">
                    View
                  </Link>
                  <Button
                    variant="ghost"
                    onClick={() => onCreateOrder?.(row.id)}
                  >
                    Create Order
                  </Button>
                  <Button variant="ghost" onClick={() => onReassign?.(row.id)}>
                    Reassign
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
