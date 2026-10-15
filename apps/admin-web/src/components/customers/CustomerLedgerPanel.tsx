import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Button, TextField } from '@groaurum/ui';
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
  /** When true, hide duplicate money summary (shown in page hero). */
  compact?: boolean;
  /** Optional statement date filter (YYYY-MM-DD). */
  showDateFilter?: boolean;
};

function entryDateKey(atIso: string): string {
  const d = new Date(atIso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function CustomerLedgerPanel({
  ledger,
  shopName,
  phoneLabel,
  compact = false,
  showDateFilter = false,
}: Props) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const filteredEntries = useMemo(() => {
    if (!fromDate && !toDate) return ledger.entries;
    return ledger.entries.filter((row) => {
      const key = entryDateKey(row.atIso);
      if (!key) return true;
      if (fromDate && key < fromDate) return false;
      if (toDate && key > toDate) return false;
      return true;
    });
  }, [ledger.entries, fromDate, toDate]);

  const filteredLedger: CustomerLedgerVm = useMemo(
    () => ({
      ...ledger,
      entries: filteredEntries,
    }),
    [ledger, filteredEntries],
  );

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
        ledger: filteredLedger,
      }),
    );
  };

  return (
    <div className="ga-cust-ledger" id="ledger">
      <div className="ga-cust-ledger__toolbar ga-cust-ledger__print-hide">
        {showDateFilter ? (
          <div className="ga-cust-ledger__dates">
            <TextField
              label="From"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <TextField
              label="To"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        ) : null}
        <Button variant="secondary" type="button" onClick={downloadStatement}>
          Download CSV
        </Button>
        <Button
          variant="secondary"
          type="button"
          onClick={() => window.print()}
        >
          Print
        </Button>
      </div>

      {!compact ? (
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
            <p className="ga-cust-ledger__label">Paid</p>
            <p className="ga-cust-ledger__value">{ledger.totalPaidLabel}</p>
          </div>
        </div>
      ) : null}

      {filteredEntries.length === 0 ? (
        <EmptyState
          title="No transactions yet."
          detail={
            ledger.entries.length === 0
              ? `${shopName} has no sales, payments, or opening balance on record.`
              : 'No transactions in the selected date range.'
          }
        />
      ) : (
        <div className="ga-table-wrap">
          <table className="ga-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((row) => (
                <tr key={row.id}>
                  <td>{row.atLabel}</td>
                  <td>
                    <span className="ga-cust-ledger__desc">
                      {row.typeLabel}
                    </span>
                    {row.referenceHref.startsWith('/') ? (
                      <Link
                        className="ga-cust-ledger__ref"
                        to={row.referenceHref}
                      >
                        {row.reference}
                      </Link>
                    ) : (
                      <span className="ga-cust-ledger__ref">{row.reference}</span>
                    )}
                  </td>
                  <td>{row.debitLabel}</td>
                  <td>{row.creditLabel}</td>
                  <td>{row.balanceLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
