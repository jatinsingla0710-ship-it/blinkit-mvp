import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@groaurum/ui';
import { EmptyState } from '@/components/ui/EmptyState';
import { requireLiveAdminApi } from '@/data/adminDataClient';
import { formatMutationError } from '@/data/mutation-errors';
import '@groaurum/ui/styles/data-table.css';
import './SalesmanCommissionLedger.css';

type Props = {
  profileId: string;
};

/** Read-only commission ledger for one salesman — explains payroll commission totals. */
export function SalesmanCommissionLedger({ profileId }: Props) {
  const entries = useQuery({
    queryKey: ['groaurum', 'salesmen', 'commission-ledger', profileId],
    queryFn: () => requireLiveAdminApi().listSalesmanCommissionEntries(profileId),
    enabled: Boolean(profileId),
  });

  return (
    <div className="ga-sm-commission">
      <h3>Commission ledger</h3>
      <p className="ga-sm-commission__hint">
        Accrued when sales convert. Reversals appear as Reversed. Totals feed
        payroll — this is not a second calculator.
      </p>
      {entries.isPending ? (
        <p className="ga-sm-commission__hint">Loading ledger…</p>
      ) : null}
      {entries.isError ? (
        <p className="ga-sm-commission__error" role="alert">
          {formatMutationError(entries.error, 'Could not load commission ledger')}
        </p>
      ) : null}
      {entries.data && entries.data.length === 0 ? (
        <EmptyState
          title="No commission entries yet"
          detail="Entries appear after converted sales with commission terms."
        />
      ) : null}
      {entries.data && entries.data.length > 0 ? (
        <div className="ga-table-wrap">
          <table className="ga-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Order</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.data.map((row) => (
                <tr key={row.id}>
                  <td>{row.createdAtLabel}</td>
                  <td>
                    <Link to={row.orderHref} className="ga-table__mono">
                      {row.orderId.slice(0, 8)}
                    </Link>
                  </td>
                  <td>{row.quantity}</td>
                  <td>{row.unitCommission}</td>
                  <td>
                    <strong>{row.commissionAmountLabel}</strong>
                  </td>
                  <td>
                    <Badge
                      tone={row.status === 'REVERSED' ? 'danger' : 'success'}
                    >
                      {row.statusLabel}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
