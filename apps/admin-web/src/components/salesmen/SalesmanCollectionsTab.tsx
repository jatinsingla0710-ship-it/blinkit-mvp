import type {
  SalesmanCollectionRow,
  SalesmanCollectionSummary,
} from '@/data/salesmen-types';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';
import './SalesmanCollectionsTab.css';

type Props = {
  summary: SalesmanCollectionSummary;
  history: SalesmanCollectionRow[];
};

export function SalesmanCollectionsTab({ summary, history }: Props) {
  return (
    <div className="ga-sm-collections">
      <div className="ga-sm-collections__cards">
        <Card>
          <p className="ga-sm-collections__label">COD Collected</p>
          <p className="ga-sm-collections__value">{summary.codCollectedLabel}</p>
        </Card>
        <Card>
          <p className="ga-sm-collections__label">Online Payments</p>
          <p className="ga-sm-collections__value">
            {summary.onlinePaymentsLabel}
          </p>
        </Card>
        <Card>
          <p className="ga-sm-collections__label">Pending Collections</p>
          <p className="ga-sm-collections__value">
            {summary.pendingCollectionsLabel}
          </p>
        </Card>
      </div>

      <Card title="Collection History">
        {history.length === 0 ? (
          <EmptyState
            title="No collection history"
            detail="COD and online settlements will appear here."
          />
        ) : (
          <div className="ga-table-wrap">
            <table className="ga-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <td className="ga-table__mono">{row.orderCode}</td>
                    <td>{row.customerName}</td>
                    <td>{row.methodLabel}</td>
                    <td>{row.amountLabel}</td>
                    <td>{row.statusLabel}</td>
                    <td>{row.atLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
