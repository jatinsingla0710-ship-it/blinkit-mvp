import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { usePermissions } from '@groaurum/auth/react';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { SupplierFormModal } from '@/components/purchasing/SupplierFormModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useSuppliersListQuery } from '@/data/hooks';
import {
  filterSupplierRows,
  PURCHASING_SECTION_LINKS,
} from '@/data/purchasing';
import '@groaurum/ui/styles/data-table.css';
import './../purchases/PurchasingPages.css';

export function SuppliersListPage() {
  const { state } = useSuppliersListQuery();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('payments:manage');
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const rows = useMemo(() => {
    if (!state.data) return [];
    return filterSupplierRows(state.data, search, status);
  }, [state.data, search, status]);

  return (
    <QueryStateGate
      title="Suppliers"
      state={state}
      emptyTitle="No suppliers yet"
      emptyDetail="Add your first supplier to start recording purchases."
    >
      {(suppliers) => (
        <div className="ga-purchasing">
          <PageHeader
            title="Suppliers"
            subtitle="Vendors you buy stock from"
            meta={`${suppliers.length} supplier(s)`}
            actions={
              canManage ? (
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  + Add supplier
                </Button>
              ) : undefined
            }
          />

          <SectionRelatedLinks
            label="Purchasing"
            links={[...PURCHASING_SECTION_LINKS]}
          />

          <div className="ga-purchasing__toolbar">
            <label className="ga-purchasing__search">
              <span className="ga-sr-only">Search suppliers</span>
              <input
                type="search"
                placeholder="Search name, mobile, city…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as 'all' | 'active' | 'inactive')
                }
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <Button
              variant="secondary"
              onClick={() => {
                setSearch('');
                setStatus('all');
              }}
            >
              Reset filters
            </Button>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              title="No matching suppliers"
              detail="Try another search, or add a new supplier."
            />
          ) : (
            <div className="ga-table-wrap">
              <table className="ga-table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Contact</th>
                    <th>Mobile</th>
                    <th>City</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="ga-purchasing__row"
                      onClick={() => navigate(`/suppliers/${row.id}`)}
                    >
                      <td>
                        <Link
                          to={`/suppliers/${row.id}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td>{row.contactPerson ?? '—'}</td>
                      <td>{row.mobileLabel ?? '—'}</td>
                      <td>{row.city ?? '—'}</td>
                      <td>{row.statusLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <SupplierFormModal
            open={createOpen && canManage}
            onClose={() => setCreateOpen(false)}
          />
        </div>
      )}
    </QueryStateGate>
  );
}
