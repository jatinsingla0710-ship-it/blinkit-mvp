import { Link } from 'react-router-dom';
import type { DeliveryRouteListRow } from '@/data/delivery-types';
import { RouteStatusBadge } from '@/components/delivery/DeliveryStatusBadges';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import '@groaurum/ui/styles/data-table.css';
import './DeliveryRoutesTable.css';

type Props = {
  rows: DeliveryRouteListRow[];
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function DeliveryRoutesTable({
  rows,
  page,
  pageCount,
  total,
  onPageChange,
}: Props) {
  return (
    <Card
      title="Delivery Trips"
      action={
        <span className="ga-dl-table__meta">
          {total} trip{total === 1 ? '' : 's'}
        </span>
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          title="No delivery trips match"
          detail="Adjust search, filter, or sort — or create a delivery trip."
        />
      ) : (
        <>
          <div className="ga-table-wrap">
            <table className="ga-table">
              <thead>
                <tr>
                  <th>Route ID</th>
                  <th>Driver</th>
                  <th>Vehicle</th>
                  <th>Delivery Area</th>
                  <th>Orders Assigned</th>
                  <th>COD Amount</th>
                  <th>Route Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link
                        to={`/delivery/${row.id}`}
                        className="ga-table__primary ga-dl-link"
                      >
                        {row.routeCode}
                      </Link>
                    </td>
                    <td>{row.driverName}</td>
                    <td className="ga-table__mono">{row.vehicleLabel}</td>
                    <td>{row.deliveryArea}</td>
                    <td>{row.ordersAssigned}</td>
                    <td>{row.codAmountLabel}</td>
                    <td>
                      <RouteStatusBadge status={row.status} />
                    </td>
                    <td>{row.updatedAtLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ga-dl-pager">
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
