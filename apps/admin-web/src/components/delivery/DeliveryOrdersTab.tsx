import { Link } from 'react-router-dom';
import type { DeliveryAssignedOrder } from '@/data/delivery-types';
import { StopDeliveryStatusBadge } from '@/components/delivery/DeliveryStatusBadges';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';
import './DeliveryOrdersTab.css';

type Props = {
  rows: DeliveryAssignedOrder[];
  canManage?: boolean;
  actionPending?: boolean;
  onMarkInProgress?: (stopId: string) => void;
  onCollectCod?: (row: DeliveryAssignedOrder) => void;
  onMarkDelivered?: (row: DeliveryAssignedOrder) => void;
  onMarkFailed?: (stopId: string, orderCode: string) => void;
};

function isOpenStop(status: DeliveryAssignedOrder['deliveryStatus']): boolean {
  return (
    status === 'pending' ||
    status === 'in_progress' ||
    status === 'out_for_delivery'
  );
}

export function DeliveryOrdersTab({
  rows,
  canManage = false,
  actionPending = false,
  onMarkInProgress,
  onCollectCod,
  onMarkDelivered,
  onMarkFailed,
}: Props) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No assigned orders"
        detail="Use Assign Orders to attach Ready for Dispatch orders to this route."
      />
    );
  }

  return (
    <div className="ga-table-wrap">
      <table className="ga-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Area</th>
            <th>Amount</th>
            <th>Payment Type</th>
            <th>Delivery Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const open = isOpenStop(row.deliveryStatus);
            return (
              <tr key={row.id}>
                <td>
                  <Link
                    to={`/orders/${row.orderId}`}
                    className="ga-table__mono ga-dl-order-link"
                  >
                    {row.orderCode}
                  </Link>
                </td>
                <td>{row.customerName}</td>
                <td>{row.areaLabel}</td>
                <td>{row.amountLabel}</td>
                <td>{row.paymentTypeLabel}</td>
                <td>
                  <StopDeliveryStatusBadge status={row.deliveryStatus} />
                </td>
                <td>
                  <div className="ga-dl-order-actions">
                    <Link
                      to={`/orders/${row.orderId}`}
                      className="ga-dl-order-link"
                    >
                      View
                    </Link>
                    {canManage && open ? (
                      <>
                        {row.deliveryStatus === 'pending' ? (
                          <Button
                            variant="ghost"
                            disabled={actionPending}
                            onClick={() => onMarkInProgress?.(row.id)}
                          >
                            Mark In Progress
                          </Button>
                        ) : null}
                        {row.codCollectable ? (
                          <Button
                            variant="ghost"
                            disabled={actionPending}
                            onClick={() => onCollectCod?.(row)}
                          >
                            Collect COD
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          disabled={actionPending}
                          onClick={() => onMarkDelivered?.(row)}
                        >
                          Mark Delivered
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={actionPending}
                          onClick={() => onMarkFailed?.(row.id, row.orderCode)}
                        >
                          Mark Failed
                        </Button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
