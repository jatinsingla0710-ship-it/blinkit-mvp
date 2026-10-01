import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import {
  filterReceivableRows,
  type ReceivableRow,
} from '@/data/customer-ledger';
import { useReceivablesSnapshotQuery } from '@/data/hooks';
import {
  summarizeReceivableRows,
} from '@/data/financial-reports';
import { ACCOUNTING_SECTION_LINKS } from '@/data/section-links';
import '@groaurum/ui/styles/data-table.css';
import './ReceivablesPage.css';

type DueFilter = 'all' | 'outstanding' | 'paid';

function ReceivablesTable({ rows }: { rows: ReceivableRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No matching customers"
        detail="Try another search or show all balances."
      />
    );
  }

  return (
    <div className="ga-table-wrap">
      <table className="ga-table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Sales</th>
            <th>Paid</th>
            <th>Due</th>
            <th>Last payment</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.customerId}>
              <td>
                <Link to={row.ledgerHref}>{row.shopName}</Link>
                <div className="ga-receivables__meta">
                  {row.phoneLabel} · {row.areaLabel}
                </div>
              </td>
              <td>{row.totalSalesLabel}</td>
              <td>{row.totalPaidLabel}</td>
              <td>
                <strong
                  className={
                    row.outstanding > 0 ? 'ga-receivables__due' : undefined
                  }
                >
                  {row.outstandingLabel}
                </strong>
              </td>
              <td>{row.lastPaymentAtLabel ?? '—'}</td>
              <td className="ga-receivables__actions">
                <Link to={row.ledgerHref}>Ledger</Link>
                {row.collectHref ? (
                  <>
                    {' · '}
                    <Link to={row.collectHref}>Collect</Link>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReceivablesPage() {
  const { state } = useReceivablesSnapshotQuery();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DueFilter>('outstanding');

  const filtered = useMemo(() => {
    if (!state.data) return [];
    return filterReceivableRows(state.data.rows, search, filter);
  }, [state.data, search, filter]);

  const summary = useMemo(
    () => summarizeReceivableRows(filtered),
    [filtered],
  );

  return (
    <QueryStateGate
      title="Receivables"
      state={state}
      emptyTitle="No customer balances yet"
      emptyDetail="Balances appear after sales and collections are recorded."
    >
      {() => (
        <div className="ga-receivables">
          <PageHeader
            title="Receivables"
            subtitle="Who owes money — from the customer ledger"
            meta={`${summary.customerCount} customers · due ${summary.totalOutstandingLabel}`}
          />

          <SectionRelatedLinks
            label="Accounting"
            links={[...ACCOUNTING_SECTION_LINKS]}
          />

          <div className="ga-receivables__summary">
            <div>
              <p className="ga-receivables__label">Due (filtered)</p>
              <p className="ga-receivables__value">
                {summary.totalOutstandingLabel}
              </p>
            </div>
            <div>
              <p className="ga-receivables__label">Sales</p>
              <p className="ga-receivables__value">{summary.totalSalesLabel}</p>
            </div>
            <div>
              <p className="ga-receivables__label">Paid</p>
              <p className="ga-receivables__value">{summary.totalPaidLabel}</p>
            </div>
          </div>

          <div className="ga-receivables__toolbar">
            <label className="ga-receivables__search">
              <span className="ga-sr-only">Search customer</span>
              <input
                type="search"
                placeholder="Search customer"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <div
              className="ga-receivables__filters"
              role="group"
              aria-label="Balance filter"
            >
              {(
                [
                  ['outstanding', 'Outstanding'],
                  ['paid', 'Paid up'],
                  ['all', 'All'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={
                    filter === id
                      ? 'ga-receivables__chip ga-receivables__chip--active'
                      : 'ga-receivables__chip'
                  }
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setSearch('');
                setFilter('outstanding');
              }}
            >
              Reset filters
            </Button>
          </div>

          <ReceivablesTable rows={filtered} />
        </div>
      )}
    </QueryStateGate>
  );
}
