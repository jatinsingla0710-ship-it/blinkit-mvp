import { Link } from 'react-router-dom';
import type { CustomerListRow } from '@/data/customers-types';
import {
  CustomerStatusBadge,
  DigitalAccessBadge,
} from '@/components/customers/CustomerStatusBadges';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';
import './CustomersTable.css';

type Props = {
  rows: CustomerListRow[];
};

export function CustomersTable({ rows }: Props) {
  return (
    <Card title="Customers">
      {rows.length === 0 ? (
        <EmptyState
          title="No customers"
          detail="Retail shops will appear here."
        />
      ) : (
        <div className="ga-table-wrap">
          <table className="ga-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Mobile</th>
                <th>Area</th>
                <th>Business Status</th>
                <th>Customer App Access</th>
                <th>Last Order</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link
                      to={`/customers/${row.id}`}
                      className="ga-table__primary ga-cust-link"
                    >
                      {row.shopName}
                    </Link>
                    <span className="ga-cust-owner">{row.ownerName}</span>
                  </td>
                  <td>{row.phoneLabel}</td>
                  <td>{row.areaLabel}</td>
                  <td>
                    <CustomerStatusBadge status={row.status} />
                  </td>
                  <td>
                    <DigitalAccessBadge
                      status={row.digitalAccess}
                      label={row.digitalAccessLabel}
                    />
                  </td>
                  <td>{row.lastOrderLabel}</td>
                  <td>
                    <Link to={`/customers/${row.id}`} className="ga-cust-action">
                      View
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
