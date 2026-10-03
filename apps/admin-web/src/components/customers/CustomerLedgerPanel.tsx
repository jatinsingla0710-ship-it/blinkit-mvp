import { Link } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import type { CustomerLedgerVm } from '@/data/customer-ledger';
import { exportCustomerStatementCsv } from '@/data/customer-ledger';
import { downloadCsvFile } from '@/data/financial-reports';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';
import './CustomerLedgerPanel.css';

type Props = {
  ledger: CustomerLedgerVm;
  shopName: string;
  phoneLabel?: string | null;
};

export function CustomerLedgerPanel({ ledger, shopName, phoneLabel }: Props) {
  const downloadStatement = () => {
    const slug = shopName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    downloadCsvFile(
      `statement-${slug || 'customer'}-${new Date().toISOString().slice(0, 10)}.csv`,
      exportCustomerStatementCsv({
        shopName,
        phoneLabel,
        generatedAtIso: new Date().toISOString(),
        ledger,
      }),
    );
  };

  return (
    <div className="ga-cust-ledger" id="ledger">
      <div className="ga-cust-ledger__toolbar ga-cust-ledger__print-hide">
        <Button variant="secondary" type="button" onClick={downloadStatement}>
          Download statement
        </Button>
        <Button
          variant="secondary"
          type="button"
          onClick={() => window.print()}
        >
          Print statement
        </Button>
      </div>

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
          <div className="ga-cust-ledger__action ga-cust-ledger__print-hide">
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
                <th className="ga-cust-ledger__print-hide" />
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
                  <td className="ga-cust-ledger__print-hide">
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
