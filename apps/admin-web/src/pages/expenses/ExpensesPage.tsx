import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { usePermissions } from '@groaurum/auth/react';
import { CompanyExpenseFormModal } from '@/components/expenses/CompanyExpenseFormModal';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { filterCompanyExpenseRows } from '@/data/company-expenses';
import { useCompanyExpensesSnapshotQuery } from '@/data/hooks';
import { ACCOUNTING_SECTION_LINKS } from '@/data/section-links';
import '@groaurum/ui/styles/data-table.css';
import './ExpensesPage.css';

export function ExpensesPage() {
  const { state } = useCompanyExpensesSnapshotQuery();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('payments:manage');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (canManage && searchParams.get('create') === '1') {
      setCreateOpen(true);
    }
  }, [canManage, searchParams]);

  const closeCreate = () => {
    setCreateOpen(false);
    if (searchParams.has('create')) {
      const next = new URLSearchParams(searchParams);
      next.delete('create');
      setSearchParams(next, { replace: true });
    }
  };

  const rows = useMemo(() => {
    if (!state.data) return [];
    return filterCompanyExpenseRows(state.data.rows, search);
  }, [state.data, search]);

  return (
    <QueryStateGate
      title="Expenses"
      state={state}
      emptyTitle="No expenses yet"
      emptyDetail="Add the first business expense to start tracking money out."
    >
      {(snapshot) => (
        <div className="ga-expenses">
          <PageHeader
            title="Expenses"
            subtitle="Track money spent by the business"
            meta={`As of ${snapshot.generatedAtLabel}`}
            actions={
              canManage ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => navigate('/expenses/scan')}
                  >
                    Receipt photo
                  </Button>
                  <Button variant="primary" onClick={() => setCreateOpen(true)}>
                    + Add expense
                  </Button>
                </>
              ) : undefined
            }
          />

          <SectionRelatedLinks
            label="Accounting"
            links={[...ACCOUNTING_SECTION_LINKS]}
          />

          <div className="ga-expenses__summary">
            <div>
              <p className="ga-expenses__label">This month</p>
              <p className="ga-expenses__value">{snapshot.thisMonthLabel}</p>
            </div>
            <div>
              <p className="ga-expenses__label">Today</p>
              <p className="ga-expenses__value">{snapshot.todayLabel}</p>
            </div>
            <div>
              <p className="ga-expenses__label">Cash</p>
              <p className="ga-expenses__value">{snapshot.cashLabel}</p>
            </div>
            <div>
              <p className="ga-expenses__label">Bank / UPI</p>
              <p className="ga-expenses__value">{snapshot.bankUpiLabel}</p>
            </div>
          </div>

          <div className="ga-expenses__toolbar">
            <label className="ga-expenses__search">
              <span className="ga-sr-only">Search expenses</span>
              <input
                type="search"
                placeholder="Search description or category"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <Button variant="secondary" onClick={() => setSearch('')}>
              Reset filters
            </Button>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              title="No matching expenses"
              detail="Try another search, or add a new expense."
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
                    <th>Payment method</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="ga-expenses__row"
                      onClick={() => navigate(`/expenses/${row.id}`)}
                    >
                      <td>{row.expenseDateLabel}</td>
                      <td>{row.categoryLabel}</td>
                      <td>
                        <Link
                          to={`/expenses/${row.id}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.description}
                        </Link>
                      </td>
                      <td>{row.amountLabel}</td>
                      <td>{row.paymentMethodLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canManage ? (
            <CompanyExpenseFormModal
              open={createOpen}
              onClose={closeCreate}
            />
          ) : null}
        </div>
      )}
    </QueryStateGate>
  );
}
