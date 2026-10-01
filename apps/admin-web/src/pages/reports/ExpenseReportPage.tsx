import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { SalesDateFilter } from '@/components/sales/SalesDateFilter';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import {
  COMPANY_EXPENSE_CATEGORIES,
  COMPANY_EXPENSE_CATEGORY_LABELS,
  COMPANY_EXPENSE_PAYMENT_METHODS,
  COMPANY_EXPENSE_PAYMENT_METHOD_LABELS,
} from '@/data/company-expenses';
import { useCompanyExpensesSnapshotQuery } from '@/data/hooks';
import { dateRangeForPreset, type SalesDatePreset } from '@/data/sales-fiscal';
import {
  downloadCsvFile,
  expenseCategoryTotals,
  expenseMethodTotals,
  exportExpensesCsv,
  filterExpensesByDate,
} from '@/data/financial-reports';
import { formatInr } from '@/data/live/format';
import '@groaurum/ui/styles/data-table.css';
import './ReportsPage.css';

function toYmd(d: Date | null): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ExpenseReportPage() {
  const { state } = useCompanyExpensesSnapshotQuery();
  const [preset, setPreset] = useState<SalesDatePreset>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [category, setCategory] = useState('all');
  const [method, setMethod] = useState('all');

  const range = useMemo(
    () =>
      dateRangeForPreset(preset, {
        from: customFrom || undefined,
        to: customTo || undefined,
      }),
    [preset, customFrom, customTo],
  );

  return (
    <div className="ga-rp-page">
      <PageHeader
        title="Expense Report"
        subtitle="Company expenses — not salesman claims"
        meta={range.label}
      />
      <Link to="/reports" className="ga-rp-back">
        ← Reports
      </Link>

      <div className="ga-rp-actions">
        <SalesDateFilter
          preset={preset}
          customFrom={customFrom}
          customTo={customTo}
          onPresetChange={setPreset}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
        />
        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All</option>
            {COMPANY_EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {COMPANY_EXPENSE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Method
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="all">All</option>
            {COMPANY_EXPENSE_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {COMPANY_EXPENSE_PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <QueryStateGate title="Expenses" state={state}>
        {(snapshot) => {
          const from = toYmd(range.from);
          const to = toYmd(range.to);
          let rows =
            range.from && range.to
              ? filterExpensesByDate(snapshot.rows, from, to)
              : [...snapshot.rows];
          if (category !== 'all') {
            rows = rows.filter((r) => r.category === category);
          }
          if (method !== 'all') {
            rows = rows.filter((r) => r.paymentMethod === method);
          }
          const total = rows.reduce((s, r) => s + r.amount, 0);
          const byCat = expenseCategoryTotals(rows);
          const byMethod = expenseMethodTotals(rows);

          return (
            <>
              <div className="ga-rp-summary">
                <div>
                  <p className="ga-rp-summary__label">Total expenses</p>
                  <p className="ga-rp-summary__value">{formatInr(total)}</p>
                </div>
                <div>
                  <p className="ga-rp-summary__label">Entries</p>
                  <p className="ga-rp-summary__value">{rows.length}</p>
                </div>
              </div>

              {byCat.length > 0 ? (
                <div className="ga-rp-summary">
                  {byCat.slice(0, 4).map((c) => (
                    <div key={c.category}>
                      <p className="ga-rp-summary__label">{c.categoryLabel}</p>
                      <p className="ga-rp-summary__value">{c.totalLabel}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {byMethod.length > 0 ? (
                <p className="ga-rp-disclaimer">
                  By method:{' '}
                  {byMethod.map((m) => `${m.methodLabel} ${m.totalLabel}`).join(' · ')}
                </p>
              ) : null}

              <Button
                variant="secondary"
                onClick={() =>
                  downloadCsvFile(
                    `expenses-${from}-${to}.csv`,
                    exportExpensesCsv(rows),
                  )
                }
              >
                Export CSV
              </Button>

              {rows.length === 0 ? (
                <EmptyState
                  title="No expenses in this period"
                  detail="Try another date range or category."
                />
              ) : (
                <div className="ga-table-wrap">
                  <table className="ga-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Category</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.expenseDateLabel}</td>
                          <td>{row.categoryLabel}</td>
                          <td>
                            <Link to={`/expenses/${row.id}`}>{row.description}</Link>
                          </td>
                          <td>{row.amountLabel}</td>
                          <td>{row.paymentMethodLabel}</td>
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
