import type {
  DeliveryCollectionRow,
  DeliveryCollectionSummary,
} from '@/data/delivery-types';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';
import './DeliveryCollectionsTab.css';

type Props = {
  summary: DeliveryCollectionSummary;
  history: DeliveryCollectionRow[];
};

export function DeliveryCollectionsTab({ summary, history }: Props) {
  return (
    <div className="ga-dl-collections">
      <div className="ga-dl-collections__cards">
        <Card>
          <p className="ga-dl-collections__label">COD Expected</p>
          <p className="ga-dl-collections__value">{summary.codExpectedLabel}</p>
        </Card>
        <Card>
          <p className="ga-dl-collections__label">COD Collected</p>
          <p className="ga-dl-collections__value">{summary.codCollectedLabel}</p>
        </Card>
        <Card>
          <p className="ga-dl-collections__label">Pending Collection</p>
          <p className="ga-dl-collections__value">
            {summary.pendingCollectionLabel}
          </p>
        </Card>
      </div>

      <Card title="Collection History">
        {history.length === 0 ? (
          <EmptyState
            title="No collection history"
            detail="COD settlements for this route will appear here."
          />
        ) : (
          <div className="ga-table-wrap">
            <table className="ga-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
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
