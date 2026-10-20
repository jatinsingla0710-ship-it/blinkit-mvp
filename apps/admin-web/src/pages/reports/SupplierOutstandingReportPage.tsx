import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { formatInr } from '@/data/live/format';
import { summarizeAgeingOutstanding } from '@/data/customer-ageing';
import {
  filterPayableRows,
  type SupplierPayableRow,
} from '@/data/supplier-ledger';
import { useSupplierPayablesSnapshotQuery } from '@/data/hooks';
import {
  downloadCsvFile,
  exportPayablesCsv,
  summarizePayableRows,
} from '@/data/financial-reports';
import '@groaurum/ui/styles/data-table.css';
import './ReportsPage.css';

type DueFilter = 'all' | 'outstanding' | 'paid';

export function SupplierOutstandingReportPage() {
  const { state } = useSupplierPayablesSnapshotQuery();
  const [search, setSearch] = useState('');
  const [due, setDue] = useState<DueFilter>('outstanding');

  const filtered = useMemo(() => {
    if (!state.data) return [];
    return filterPayableRows(state.data.rows, search, due);
  }, [state.data, search, due]);

  const summary = useMemo(
    () => summarizePayableRows(filtered),
    [filtered],
  );

  const ageing = useMemo(
    () =>
      state.data ? summarizeAgeingOutstanding(state.data.rows) : undefined,
    [state.data],
  );

  return (
    <div className="ga-rp-page">
      <PageHeader
        title="Supplier Outstanding"
        subtitle="Balances from the supplier ledger — same as Money to Pay"
      />
      <Link to="/reports" className="ga-rp-back">
        ← Reports
      </Link>

      <QueryStateGate title="Supplier outstanding" state={state}>
        {() => (
          <>
            <div className="ga-rp-summary">
              <div>
                <p className="ga-rp-summary__label">To pay (filtered)</p>
                <p className="ga-rp-summary__value">
                  {summary.totalOutstandingLabel}
                </p>
              </div>
              <div>
                <p className="ga-rp-summary__label">Purchases (filtered)</p>
                <p className="ga-rp-summary__value">
                  {summary.totalPurchasesLabel}
                </p>
              </div>
              <div>
                <p className="ga-rp-summary__label">Paid (filtered)</p>
                <p className="ga-rp-summary__value">{summary.totalPaidLabel}</p>
              </div>
              <div>
                <p className="ga-rp-summary__label">Credit (filtered)</p>
                <p className="ga-rp-summary__value">
                  {summary.totalSupplierCreditLabel}
                </p>
              </div>
              <div>
                <p className="ga-rp-summary__label">Suppliers</p>
                <p className="ga-rp-summary__value">{summary.supplierCount}</p>
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
                placeholder="Search supplier"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                value={due}
                onChange={(e) => setDue(e.target.value as DueFilter)}
              >
                <option value="outstanding">To pay</option>
                <option value="all">All</option>
                <option value="paid">Settled</option>
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
                    `supplier-outstanding-${new Date().toISOString().slice(0, 10)}.csv`,
                    exportPayablesCsv(filtered),
                  )
                }
              >
                Export CSV
              </Button>
              <Link to="/payables">Open Money to Pay →</Link>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                title="No matching suppliers"
                detail="Try another search or show all balances."
              />
            ) : (
              <div className="ga-table-wrap">
                <table className="ga-table">
                  <thead>
                    <tr>
                      <th>Supplier</th>
                      <th>Purchases</th>
                      <th>Paid</th>
                      <th>To pay</th>
                      <th>Age</th>
                      <th>Last Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row: SupplierPayableRow) => (
                      <tr key={row.supplierId}>
                        <td>
                          <Link to={row.ledgerHref}>{row.supplierName}</Link>
                        </td>
                        <td>{row.totalPurchasesLabel}</td>
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
