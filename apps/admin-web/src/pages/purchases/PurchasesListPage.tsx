import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { usePermissions } from '@groaurum/auth/react';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { usePurchasesListQuery } from '@/data/hooks';
import {
  filterPurchaseRows,
  PURCHASING_SECTION_LINKS,
  type PurchaseStatus,
} from '@/data/purchasing';
import '@groaurum/ui/styles/data-table.css';
import './PurchasingPages.css';

export function PurchasesListPage() {
  const { state } = usePurchasesListQuery();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('payments:manage');
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | PurchaseStatus>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const rows = useMemo(() => {
    if (!state.data) return [];
    return filterPurchaseRows(state.data, {
      query: search,
      status,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  }, [state.data, search, status, dateFrom, dateTo]);

  return (
    <QueryStateGate
      title="Purchases"
      state={state}
      emptyTitle="No purchases yet"
      emptyDetail="Create a purchase bill to receive stock into inventory."
    >
      {(purchases) => (
        <div className="ga-purchasing">
          <PageHeader
            title="Purchases"
            subtitle="Supplier bills and stock receipts"
            meta={`${purchases.length} purchase(s)`}
            actions={
              canManage ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => navigate('/purchases/scan')}
                  >
                    Bill photo
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => navigate('/purchases/new')}
                  >
                    + New purchase
                  </Button>
                </>
              ) : undefined
            }
          />

          <SectionRelatedLinks
            label="Purchasing"
            links={[...PURCHASING_SECTION_LINKS]}
          />

          <div className="ga-purchasing__toolbar">
            <label className="ga-purchasing__search">
              <span className="ga-sr-only">Search purchases</span>
              <input
                type="search"
                placeholder="Bill number or supplier…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as 'all' | PurchaseStatus)
                }
              >
                <option value="all">All</option>
                <option value="DRAFT">Draft</option>
                <option value="RECEIVED">Received</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </label>
            <label>
              From
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </label>
            <Button
              variant="secondary"
              onClick={() => {
                setSearch('');
                setStatus('all');
                setDateFrom('');
                setDateTo('');
              }}
            >
              Reset filters
            </Button>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              title="No matching purchases"
              detail="Try another filter, or create a new purchase."
            />
          ) : (
            <div className="ga-table-wrap">
              <table className="ga-table">
                <thead>
                  <tr>
                    <th>Bill</th>
                    <th>Supplier</th>
                    <th>Date</th>
                    <th>Warehouse</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="ga-purchasing__row"
                      onClick={() => navigate(`/purchases/${row.id}`)}
                    >
                      <td>
                        <Link
                          to={`/purchases/${row.id}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.billNumber}
                        </Link>
                      </td>
                      <td>{row.supplierName}</td>
                      <td>{row.purchaseDateLabel}</td>
                      <td>{row.warehouseName}</td>
                      <td>{row.itemCount}</td>
                      <td>{row.totalLabel}</td>
                      <td>{row.statusLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </QueryStateGate>
  );
}
