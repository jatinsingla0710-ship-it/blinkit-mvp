import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { formatInr } from '@/data/live/format';
import {
  filterReceivableRows,
  type ReceivableRow,
} from '@/data/customer-ledger';
import { useReceivablesSnapshotQuery } from '@/data/hooks';
import {
  downloadCsvFile,
  exportReceivablesCsv,
  summarizeReceivableRows,
} from '@/data/financial-reports';
import '@groaurum/ui/styles/data-table.css';
import './ReportsPage.css';

type DueFilter = 'all' | 'outstanding' | 'paid';

export function OutstandingReportPage() {
  const { state } = useReceivablesSnapshotQuery();
  const [search, setSearch] = useState('');
  const [due, setDue] = useState<DueFilter>('outstanding');

  const filtered = useMemo(() => {
    if (!state.data) return [];
    return filterReceivableRows(state.data.rows, search, due);
  }, [state.data, search, due]);

  const summary = useMemo(
    () => summarizeReceivableRows(filtered),
    [filtered],
  );

  const ageing = state.data?.ageingTotals;

  return (
    <div className="ga-rp-page">
      <PageHeader
        title="Customer Outstanding"
        subtitle="Balances from the customer ledger — same as Receivables"
      />
      <Link to="/reports" className="ga-rp-back">
        ← Reports
      </Link>

      <QueryStateGate title="Outstanding" state={state}>
        {() => (
          <>
            <div className="ga-rp-summary">
              <div>
                <p className="ga-rp-summary__label">Outstanding (filtered)</p>
                <p className="ga-rp-summary__value">
                  {summary.totalOutstandingLabel}
                </p>
              </div>
              <div>
                <p className="ga-rp-summary__label">Sales (filtered)</p>
                <p className="ga-rp-summary__value">{summary.totalSalesLabel}</p>
              </div>
              <div>
                <p className="ga-rp-summary__label">Paid (filtered)</p>
                <p className="ga-rp-summary__value">{summary.totalPaidLabel}</p>
              </div>
              <div>
                <p className="ga-rp-summary__label">Customers</p>
                <p className="ga-rp-summary__value">{summary.customerCount}</p>
              </div>
            </div>

            {ageing ? (
              <div className="ga-rp-summary">
                <div>
                  <p className="ga-rp-summary__label">Current</p>
                  <p className="ga-rp-summary__value">{formatInr(ageing.current)}</p>
                </div>
                <div>
                  <p className="ga-rp-summary__label">1–30 days</p>
                  <p className="ga-rp-summary__value">
                    {formatInr(ageing.days_1_30)}
                  </p>
                </div>
                <div>
                  <p className="ga-rp-summary__label">31–60 days</p>
                  <p className="ga-rp-summary__value">
                    {formatInr(ageing.days_31_60)}
                  </p>
                </div>
                <div>
                  <p className="ga-rp-summary__label">61+ days</p>
                  <p className="ga-rp-summary__value">
                    {formatInr(ageing.days_61_plus)}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="ga-rp-actions">
              <input
                type="search"
                placeholder="Search customer"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                value={due}
                onChange={(e) => setDue(e.target.value as DueFilter)}
              >
                <option value="outstanding">Outstanding only</option>
                <option value="all">All</option>
                <option value="paid">Paid up</option>
              </select>
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch('');
                  setDue('outstanding');
                }}
              >
                Reset filters
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  downloadCsvFile(
                    `outstanding-${new Date().toISOString().slice(0, 10)}.csv`,
                    exportReceivablesCsv(filtered),
                  )
                }
              >
                Export CSV
              </Button>
              <Link to="/receivables">Open Receivables →</Link>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                title="No matching customers"
                detail="Try another search or show all balances."
              />
            ) : (
              <div className="ga-table-wrap">
                <table className="ga-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Sales</th>
                      <th>Paid</th>
                      <th>Outstanding</th>
                      <th>Age</th>
                      <th>Last Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row: ReceivableRow) => (
                      <tr key={row.customerId}>
                        <td>
                          <Link to={row.ledgerHref}>{row.shopName}</Link>
                        </td>
                        <td>{row.totalSalesLabel}</td>
                        <td>{row.totalPaidLabel}</td>
                        <td>{row.outstandingLabel}</td>
                        <td>
                          {row.outstanding > 0 ? row.ageingLabel : '—'}
                        </td>
                        <td>{row.lastPaymentAtLabel ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </QueryStateGate>
    </div>
  );
}
