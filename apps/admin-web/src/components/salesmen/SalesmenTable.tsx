import { Link } from 'react-router-dom';
import type { SalesmanListRow } from '@/data/salesmen-types';
import { SalesmanStatusBadge } from '@/components/salesmen/SalesmanStatusBadges';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import '@groaurum/ui/styles/data-table.css';
import './SalesmenTable.css';

type Props = {
  rows: SalesmanListRow[];
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function SalesmenTable({
  rows,
  page,
  pageCount,
  total,
  onPageChange,
}: Props) {
  return (
    <Card
      title="Sales Team"
      action={
        <span className="ga-sm-table__meta">
          {total} salesman{total === 1 ? '' : 'men'}
        </span>
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          title="No salesmen match"
          detail="Adjust search, filter, or sort."
        />
      ) : (
        <>
          <div className="ga-table-wrap">
            <table className="ga-table">
              <thead>
                <tr>
                  <th>Salesman Name</th>
                  <th>Territory</th>
                  <th>Assigned Customers</th>
                  <th>Orders This Month</th>
                  <th>Order totals (all-time)</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link
                        to={`/salesmen/${row.id}`}
                        className="ga-table__primary ga-sm-link"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td>{row.territory}</td>
                    <td>{row.assignedCustomers}</td>
                    <td>{row.ordersThisMonth}</td>
                    <td>{row.collectionsLabel}</td>
                    <td>
                      <SalesmanStatusBadge status={row.status} />
                    </td>
                    <td>{row.updatedAtLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ga-sm-pager">
            <Button
              variant="ghost"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <span>
              Page {page} of {pageCount}
            </span>
            <Button
              variant="ghost"
              disabled={page >= pageCount}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
