import { Link } from 'react-router-dom';
import type { SaleRegisterRow } from '@/data/sales-types';
import { saleDetailHref } from '@/data/order-helpers';
import { PaymentStatusBadge } from '@/components/orders/OrderStatusBadges';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@groaurum/ui';
import './SalesRegister.css';

type Props = {
  rows: SaleRegisterRow[];
  loading?: boolean;
  onExportCsv?: () => void;
};

/**
 * Converted sales register — links open /sales/:saleId (not Orders).
 */
export function SalesRegister({ rows, loading, onExportCsv }: Props) {
  if (loading) {
    return (
      <Card className="ga-sales-register">
        <p className="ga-sales-register__loading">Loading sales register…</p>
      </Card>
    );
  }

  return (
    <Card className="ga-sales-register">
      {onExportCsv ? (
        <div className="ga-sales-register__toolbar">
          <Button variant="secondary" onClick={onExportCsv}>
            Export CSV
          </Button>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState
          title="No sales yet"
          detail="Your sales analytics will appear here once orders are delivered and converted into sales."
        />
      ) : (
        <div className="ga-sales-register__table-wrap">
          <table className="ga-sales-register__table">
            <thead>
              <tr>
                <th>Invoice Number</th>
                <th>Sale Date</th>
                <th>Customer</th>
                <th>Order Number</th>
                <th>Total Amount</th>
                <th>Payment Status</th>
                <th>Payment Method</th>
                <th>Sales Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.saleId}>
                  <td>
                    <Link
                      className="ga-sales-register__link"
                      to={saleDetailHref(row.saleId)}
                    >
                      {row.invoiceNumber}
                    </Link>
                  </td>
                  <td>{row.saleDateLabel}</td>
                  <td>{row.customerName}</td>
                  <td>{row.orderCode}</td>
                  <td>{row.amountLabel}</td>
                  <td>
                    <PaymentStatusBadge status={row.paymentStatus} />
                  </td>
                  <td>{row.paymentMethodLabel}</td>
                  <td>{row.saleStatusLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
