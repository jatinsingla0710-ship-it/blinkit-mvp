import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { formatInr } from '@/data/live/format';
import { usePayrollMonthSnapshotQuery } from '@/data/hooks';
import { payrollMonthStart } from '@/data/salesman-payroll';
import { TEAM_SECTION_LINKS } from '@/data/section-links';
import '@groaurum/ui/styles/data-table.css';
import './SalesmenPayrollPage.css';

function currentMonthInput(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Team → Salesmen → Payroll month overview.
 * Not a top-level sidebar item.
 */
export function SalesmenPayrollPage() {
  const [monthInput, setMonthInput] = useState(currentMonthInput);
  const month = useMemo(
    () => payrollMonthStart(`${monthInput}-01`),
    [monthInput],
  );
  const { state } = usePayrollMonthSnapshotQuery(month);
  const navigate = useNavigate();

  return (
    <QueryStateGate
      title="Payroll"
      state={state}
      emptyTitle="No payroll yet"
      emptyDetail="Open a salesman and calculate payroll for this month."
    >
      {(snapshot) => (
        <div className="ga-payroll-month">
          <PageHeader
            title="Payroll"
            subtitle="Monthly salary and commission"
            meta={snapshot.monthLabel}
          />

          <SectionRelatedLinks
            label="Team section"
            links={[...TEAM_SECTION_LINKS]}
          />

          <label className="ga-payroll-month__month">
            <span>Month</span>
            <input
              type="month"
              value={monthInput}
              onChange={(e) => setMonthInput(e.target.value || currentMonthInput())}
            />
          </label>

          <div className="ga-payroll-month__summary">
            <div>
              <p className="ga-payroll-month__label">Total payroll</p>
              <p className="ga-payroll-month__value">{snapshot.totalPayrollLabel}</p>
            </div>
            <div>
              <p className="ga-payroll-month__label">Paid</p>
              <p className="ga-payroll-month__value">{snapshot.paidTotalLabel}</p>
            </div>
            <div>
              <p className="ga-payroll-month__label">Pending</p>
              <p className="ga-payroll-month__value">{snapshot.pendingTotalLabel}</p>
            </div>
            <div>
              <p className="ga-payroll-month__label">Salesmen</p>
              <p className="ga-payroll-month__value">{snapshot.salesmanCount}</p>
            </div>
          </div>

          {snapshot.rows.length === 0 ? (
            <EmptyState
              title="No payroll for this month"
              detail="Open a salesman profile and use Payroll → Calculate payroll."
            />
          ) : (
            <div className="ga-table-wrap">
              <table className="ga-table">
                <thead>
                  <tr>
                    <th>Salesman</th>
                    <th>Salary</th>
                    <th>Commission</th>
                    <th>Allowances</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.rows.map((row) => {
                    const allowances =
                      row.dailyAllowance + row.otherAllowance;
                    return (
                      <tr
                        key={row.id}
                        className="ga-payroll-month__row"
                        onClick={() =>
                          navigate(`/salesmen/${row.salesmanId}?tab=payroll`)
                        }
                      >
                        <td>
                          <Link
                            to={`/salesmen/${row.salesmanId}?tab=payroll`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {row.salesmanName}
                          </Link>
                        </td>
                        <td>{row.baseSalaryLabel}</td>
                        <td>{row.earnedCommissionLabel}</td>
                        <td>
                          {allowances === 0 ? '—' : formatInr(allowances)}
                        </td>
                        <td>{row.totalAmountLabel}</td>
                        <td>{row.statusLabel}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </QueryStateGate>
  );
}
