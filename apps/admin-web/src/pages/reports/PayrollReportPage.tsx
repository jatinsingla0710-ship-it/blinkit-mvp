import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { usePayrollMonthSnapshotQuery } from '@/data/hooks';
import {
  payrollMonthStart,
  PAYROLL_STATUSES,
  PAYROLL_STATUS_LABELS,
} from '@/data/salesman-payroll';
import {
  downloadCsvFile,
  exportPayrollCsv,
  summarizePayrollRows,
} from '@/data/financial-reports';
import '@groaurum/ui/styles/data-table.css';
import './ReportsPage.css';

function currentMonthInput(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function PayrollReportPage() {
  const [monthInput, setMonthInput] = useState(currentMonthInput);
  const [status, setStatus] = useState('all');
  const month = useMemo(
    () => payrollMonthStart(`${monthInput}-01`),
    [monthInput],
  );
  const { state } = usePayrollMonthSnapshotQuery(month);

  return (
    <div className="ga-rp-page">
      <PageHeader
        title="Payroll Report"
        subtitle="Monthly salary and commission snapshots — not recalculated here"
        meta={month}
      />
      <Link to="/reports" className="ga-rp-back">
        ← Reports
      </Link>

      <div className="ga-rp-actions">
        <label>
          Month
          <input
            type="month"
            value={monthInput}
            onChange={(e) => setMonthInput(e.target.value || currentMonthInput())}
          />
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option>
            {PAYROLL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PAYROLL_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="secondary"
          onClick={() => {
            setMonthInput(currentMonthInput());
            setStatus('all');
          }}
        >
          Reset filters
        </Button>
        <Link to="/salesmen/payroll">Payroll overview →</Link>
      </div>

      <QueryStateGate title="Payroll" state={state}>
        {(snapshot) => {
          const rows =
            status === 'all'
              ? snapshot.rows
              : snapshot.rows.filter((r) => r.status === status);
          const summary = summarizePayrollRows(rows);

          return (
            <>
              <div className="ga-rp-summary">
                <div>
                  <p className="ga-rp-summary__label">Total (filtered)</p>
                  <p className="ga-rp-summary__value">
                    {summary.totalPayrollLabel}
                  </p>
                </div>
                <div>
                  <p className="ga-rp-summary__label">Paid (filtered)</p>
                  <p className="ga-rp-summary__value">{summary.paidTotalLabel}</p>
                </div>
                <div>
                  <p className="ga-rp-summary__label">Pending (filtered)</p>
                  <p className="ga-rp-summary__value">
                    {summary.pendingTotalLabel}
                  </p>
                </div>
                <div>
                  <p className="ga-rp-summary__label">Salesmen</p>
                  <p className="ga-rp-summary__value">{summary.salesmanCount}</p>
                </div>
              </div>

              <Button
                variant="secondary"
                onClick={() =>
                  downloadCsvFile(
                    `payroll-${month}.csv`,
                    exportPayrollCsv(rows),
                  )
                }
              >
                Export CSV
              </Button>

              {rows.length === 0 ? (
                <EmptyState
                  title="No payroll for this month"
                  detail="Calculate payroll from a salesman profile first."
                />
              ) : (
                <div className="ga-table-wrap">
                  <table className="ga-table">
                    <thead>
                      <tr>
                        <th>Salesman</th>
                        <th>Salary</th>
                        <th>Commission</th>
                        <th>Adjustments</th>
                        <th>Total</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <Link to={`/salesmen/${row.salesmanId}?tab=payroll`}>
                              {row.salesmanName}
                            </Link>
                          </td>
                          <td>{row.baseSalaryLabel}</td>
                          <td>{row.earnedCommissionLabel}</td>
                          <td>{row.adjustmentsLabel}</td>
                          <td>{row.totalAmountLabel}</td>
                          <td>{row.statusLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          );
        }}
      </QueryStateGate>
    </div>
  );
}
