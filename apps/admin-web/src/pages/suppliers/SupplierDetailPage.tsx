import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { usePermissions } from '@groaurum/auth/react';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { SupplierFormModal } from '@/components/purchasing/SupplierFormModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useSupplierDetailQuery } from '@/data/hooks';
import { PURCHASING_SECTION_LINKS } from '@/data/purchasing';
import '@groaurum/ui/styles/data-table.css';
import '../purchases/PurchasingPages.css';

export function SupplierDetailPage() {
  const { supplierId } = useParams();
  const { state } = useSupplierDetailQuery(supplierId);
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('payments:manage');
  const [editOpen, setEditOpen] = useState(false);

  return (
    <QueryStateGate
      title="Supplier"
      state={state}
      emptyTitle="Supplier not found"
      emptyDetail="This supplier may have been removed."
    >
      {(data) => (
        <div className="ga-purchasing">
          <PageHeader
            title={data.supplier.name}
            subtitle="Supplier details and purchase history"
            meta={data.supplier.statusLabel}
            actions={
              canManage ? (
                <Button variant="secondary" onClick={() => setEditOpen(true)}>
                  Edit
                </Button>
              ) : undefined
            }
          />

          <SectionRelatedLinks
            label="Purchasing"
            links={[...PURCHASING_SECTION_LINKS]}
          />

          <section className="ga-purchasing__card">
            <h2>Details</h2>
            <dl className="ga-purchasing__dl">
              <div>
                <dt>Contact</dt>
                <dd>{data.supplier.contactPerson ?? '—'}</dd>
              </div>
              <div>
                <dt>Mobile</dt>
                <dd>{data.supplier.mobileLabel ?? '—'}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{data.supplier.email ?? '—'}</dd>
              </div>
              <div>
                <dt>GSTIN</dt>
                <dd>{data.supplier.gstin ?? '—'}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>
                  {[data.supplier.addressLine, data.supplier.city, data.supplier.state]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </dd>
              </div>
              <div>
                <dt>Notes</dt>
                <dd>{data.supplier.notes ?? '—'}</dd>
              </div>
            </dl>
            <p className="ga-purchasing__note">
              Supplier balances and payments are not tracked in this phase.
            </p>
          </section>

          <section className="ga-purchasing__card">
            <div className="ga-purchasing__card-head">
              <h2>Purchases</h2>
              {canManage ? (
                <Link
                  className="ga-btn ga-btn--secondary"
                  to={`/purchases/new?supplierId=${data.supplier.id}`}
                >
                  + New purchase
                </Link>
              ) : null}
            </div>
            {data.purchases.length === 0 ? (
              <EmptyState
                title="No purchases yet"
                detail="Create a purchase bill to receive stock from this supplier."
              />
            ) : (
              <div className="ga-table-wrap">
                <table className="ga-table">
                  <thead>
                    <tr>
                      <th>Bill</th>
                      <th>Date</th>
                      <th>Warehouse</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.purchases.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <Link to={`/purchases/${row.id}`}>{row.billNumber}</Link>
                        </td>
                        <td>{row.purchaseDateLabel}</td>
                        <td>{row.warehouseName}</td>
                        <td>{row.totalLabel}</td>
                        <td>{row.statusLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <SupplierFormModal
            open={editOpen && canManage}
            supplier={data.supplier}
            onClose={() => setEditOpen(false)}
          />
        </div>
      )}
    </QueryStateGate>
  );
}
