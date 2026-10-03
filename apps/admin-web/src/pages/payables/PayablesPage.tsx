import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import {
  filterPayableRows,
  type SupplierPayableRow,
} from '@/data/supplier-ledger';
import { useSupplierPayablesSnapshotQuery } from '@/data/hooks';
import { formatInr } from '@/data/live/format';
import { ACCOUNTING_SECTION_LINKS } from '@/data/section-links';
import '@groaurum/ui/styles/data-table.css';
import '../receivables/ReceivablesPage.css';

type DueFilter = 'all' | 'outstanding' | 'paid';

function PayablesTable({ rows }: { rows: SupplierPayableRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No matching suppliers"
        detail="Try another search or show all balances."
      />
    );
  }

  return (
    <div className="ga-table-wrap">
      <table className="ga-table">
        <thead>
          <tr>
            <th>Supplier</th>
            <th>Purchases</th>
            <th>Paid</th>
            <th>To pay</th>
            <th>Age</th>
            <th>Last payment</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.supplierId}>
              <td>
                <Link to={row.ledgerHref}>{row.supplierName}</Link>
                <div className="ga-receivables__meta">
                  {row.contactLabel}
                  {row.mobileLabel ? ` · ${row.mobileLabel}` : ''}
                </div>
              </td>
              <td>{row.totalPurchasesLabel}</td>
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
              <td>
                {row.outstanding > 0 ? (
                  <>
                    {row.ageingLabel}
                    {row.oldestOpenDays != null ? (
                      <div className="ga-receivables__meta">
                        {row.oldestOpenDays} day
                        {row.oldestOpenDays === 1 ? '' : 's'} open
                      </div>
                    ) : null}
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td>{row.lastPaymentAtLabel ?? '—'}</td>
              <td className="ga-receivables__actions">
                <Link to={row.ledgerHref}>Ledger</Link>
                {row.outstanding > 0 ? (
                  <>
                    {' · '}
                    <Link to={row.payHref}>Pay</Link>
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

export function PayablesPage() {
  const { state } = useSupplierPayablesSnapshotQuery();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DueFilter>('outstanding');

  const filtered = useMemo(() => {
    if (!state.data) return [];
    return filterPayableRows(state.data.rows, search, filter);
  }, [state.data, search, filter]);

  const totalToPay = useMemo(
    () =>
      filtered.reduce((sum, row) => sum + Math.max(row.outstanding, 0), 0),
    [filtered],
  );

  return (
    <QueryStateGate
      title="Money to Pay"
      state={state}
      emptyTitle="No supplier balances yet"
      emptyDetail="Balances appear after purchases are received and payments are recorded."
    >
      {(snapshot) => (
        <div className="ga-receivables">
          <PageHeader
            title="Money to Pay"
            subtitle="Who you need to pay — from supplier purchases"
            meta={`${snapshot.suppliersWithDues} suppliers · due ${snapshot.totalOutstandingLabel}`}
          />

          <SectionRelatedLinks
            label="Money"
            links={[...ACCOUNTING_SECTION_LINKS]}
          />

          <div className="ga-receivables__summary">
            <div>
              <p className="ga-receivables__label">To pay (filtered)</p>
              <p className="ga-receivables__value">{formatInr(totalToPay)}</p>
            </div>
            <div>
              <p className="ga-receivables__label">All due</p>
              <p className="ga-receivables__value">
                {snapshot.totalOutstandingLabel}
              </p>
            </div>
            <div>
              <p className="ga-receivables__label">Suppliers with dues</p>
              <p className="ga-receivables__value">{snapshot.suppliersWithDues}</p>
            </div>
          </div>

          <div className="ga-receivables__toolbar">
            <label className="ga-receivables__search">
              <span className="ga-sr-only">Search supplier</span>
              <input
                type="search"
                placeholder="Search supplier"
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
                  ['outstanding', 'To pay'],
                  ['paid', 'Settled'],
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

          <PayablesTable rows={filtered} />
        </div>
      )}
    </QueryStateGate>
  );
}
