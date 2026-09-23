import { Link } from 'react-router-dom';
import type { OrderListRow } from '@/data/orders-types';
import { getAttentionAwareNextAction } from '@/data/order-attention';
import { fulfillmentStatusLabel } from '@/data/order-helpers';
import {
  DeliveryStatusBadge,
  PaymentStatusBadge,
} from '@/components/orders/OrderStatusBadges';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';
import './OrdersTable.css';

type Props = {
  rows: OrderListRow[];
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
  showAttentionColumn?: boolean;
};

function nextActionHref(row: OrderListRow): string {
  const action = getAttentionAwareNextAction(row);
  const tab = action.tab ? `?tab=${action.tab}` : '';
  return `/orders/${row.id}${tab}`;
}

export function OrdersTable({
  rows,
  page,
  pageCount,
  total,
  onPageChange,
  showAttentionColumn = true,
}: Props) {
  return (
    <Card title="Orders">
      {rows.length === 0 ? (
        <EmptyState
          title="No matching orders"
          detail="Try another workflow card or adjust your search."
        />
      ) : (
        <>
          <div className="ga-table-wrap">
            <table className="ga-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Current Stage</th>
                  <th>Payment</th>
                  <th>Delivery</th>
                  {showAttentionColumn ? <th>Attention</th> : null}
                  <th>Next Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const nextAction = getAttentionAwareNextAction(row);
                  return (
                    <tr
                      key={row.id}
                      className={
                        row.needsAttention ? 'ga-orders-row--attention' : ''
                      }
                    >
                      <td>
                        <Link
                          to={`/orders/${row.id}`}
                          className="ga-table__mono ga-orders-link"
                        >
                          {row.orderCode}
                        </Link>
                      </td>
                      <td>
                        <span className="ga-table__primary">{row.customerName}</span>
                      </td>
                      <td>{fulfillmentStatusLabel(row.fulfillmentStatus)}</td>
                      <td>
                        <PaymentStatusBadge status={row.paymentStatus} />
                      </td>
                      <td>
                        <DeliveryStatusBadge status={row.deliveryStatus} />
                      </td>
                      {showAttentionColumn ? (
                        <td>
                          {row.needsAttention ? (
                            <span
                              className="ga-orders-attention-reason"
                              title={row.attentionDescription}
                            >
                              {row.attentionReason ?? 'Needs attention'}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                      ) : null}
                      <td>
                        <Link
                          to={nextActionHref(row)}
                          className={`ga-orders-action${
                            nextAction.kind === 'action'
                              ? ' ga-orders-action--primary'
                              : ''
                          }`}
                          title={nextAction.hint}
                        >
                          {nextAction.label}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="ga-orders-pager">
            <span>
              Page {page} of {pageCount} - {total} orders
            </span>
            <div className="ga-orders-pager__btns">
              <button
                type="button"
                className="ga-orders-pager__btn"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="ga-orders-pager__btn"
                disabled={page >= pageCount}
                onClick={() => onPageChange(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
