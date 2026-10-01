import { Link } from 'react-router-dom';
import type { CustomerLedgerVm } from '@/data/customer-ledger';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';
import './CustomerLedgerPanel.css';

type Props = {
  ledger: CustomerLedgerVm;
  shopName: string;
};

export function CustomerLedgerPanel({ ledger, shopName }: Props) {
  return (
    <div className="ga-cust-ledger" id="ledger">
      <div className="ga-cust-ledger__summary">
        <div>
          <p className="ga-cust-ledger__label">Outstanding</p>
          <p className="ga-cust-ledger__value ga-cust-ledger__value--due">
            {ledger.outstandingLabel}
          </p>
        </div>
        <div>
          <p className="ga-cust-ledger__label">Sales</p>
          <p className="ga-cust-ledger__value">{ledger.totalSalesLabel}</p>
        </div>
        <div>
          <p className="ga-cust-ledger__label">Payments received</p>
          <p className="ga-cust-ledger__value">{ledger.totalPaidLabel}</p>
        </div>
        <div>
          <p className="ga-cust-ledger__label">Last transaction</p>
          <p className="ga-cust-ledger__value">
            {ledger.lastTransactionAtLabel ?? '—'}
          </p>
        </div>
        {ledger.collectHref ? (
          <div className="ga-cust-ledger__action">
            <Link className="ga-cust-ledger__collect" to={ledger.collectHref}>
              Record collection
            </Link>
            <p className="ga-cust-ledger__hint">
              Opens the open order so you can mark payment received.
            </p>
          </div>
        ) : null}
      </div>

      {ledger.entries.length === 0 ? (
        <EmptyState
          title="No transactions yet"
          detail={`${shopName} has no sales or payments on record.`}
        />
      ) : (
        <div className="ga-table-wrap">
          <table className="ga-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Reference</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Balance</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ledger.entries.map((row) => (
                <tr key={row.id}>
                  <td>{row.atLabel}</td>
                  <td>{row.typeLabel}</td>
                  <td className="ga-table__mono">
                    <Link to={row.referenceHref}>{row.reference}</Link>
                  </td>
                  <td>{row.debitLabel}</td>
                  <td>{row.creditLabel}</td>
                  <td>{row.balanceLabel}</td>
                  <td>
                    {row.collectHref ? (
                      <Link to={row.collectHref}>Collect</Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
