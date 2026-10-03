import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { usePermissions } from '@groaurum/auth/react';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { SupplierFormModal } from '@/components/purchasing/SupplierFormModal';
import { SupplierPaymentModal } from '@/components/purchasing/SupplierPaymentModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useSupplierDetailQuery } from '@/data/hooks';
import { useDeleteSupplierPaymentMutation } from '@/data/mutations';
import { formatMutationError } from '@/data/mutation-errors';
import { PURCHASING_SECTION_LINKS } from '@/data/purchasing';
import '@groaurum/ui/styles/data-table.css';
import '../purchases/PurchasingPages.css';

export function SupplierDetailPage() {
  const { supplierId } = useParams();
  const { state } = useSupplierDetailQuery(supplierId);
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('payments:manage');
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deletePayment = useDeleteSupplierPaymentMutation();

  useEffect(() => {
    if (canManage && searchParams.get('pay') === '1') {
      setPayOpen(true);
    }
  }, [canManage, searchParams]);

  const closePay = () => {
    setPayOpen(false);
    if (searchParams.has('pay')) {
      const next = new URLSearchParams(searchParams);
      next.delete('pay');
      setSearchParams(next, { replace: true });
    }
  };

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
            subtitle="Supplier balance, ledger, and purchase history"
            meta={data.supplier.statusLabel}
            actions={
              canManage ? (
                <>
                  <Button variant="primary" onClick={() => setPayOpen(true)}>
                    Record payment
                  </Button>
                  <Button variant="secondary" onClick={() => setEditOpen(true)}>
                    Edit
                  </Button>
                </>
              ) : undefined
            }
          />

          <SectionRelatedLinks
            label="Purchasing"
            links={[...PURCHASING_SECTION_LINKS]}
          />

          <section className="ga-purchasing__card">
            <h2>Money with this supplier</h2>
            <dl className="ga-purchasing__dl">
              <div>
                <dt>Purchases received</dt>
                <dd>{data.ledger.totalPurchasesLabel}</dd>
              </div>
              <div>
                <dt>Paid</dt>
                <dd>{data.ledger.totalPaidLabel}</dd>
              </div>
              <div>
                <dt>You need to pay</dt>
                <dd>
                  <strong>{data.ledger.outstandingLabel}</strong>
                </dd>
              </div>
              <div>
                <dt>Last payment</dt>
                <dd>{data.ledger.lastPaymentAtLabel ?? '—'}</dd>
              </div>
            </dl>
            {data.ledger.outstanding > 0 ? (
              <p className="ga-purchasing__note">
                You need to pay this supplier {data.ledger.outstandingLabel}.
              </p>
            ) : data.ledger.outstanding < 0 ? (
              <p className="ga-purchasing__note">
                Advance paid to this supplier:{' '}
                {data.ledger.outstandingLabel.replace('-', '')}.
              </p>
            ) : (
              <p className="ga-purchasing__note">
                This supplier balance is settled.
              </p>
            )}
          </section>

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
          </section>

          <section className="ga-purchasing__card">
            <h2>Supplier ledger</h2>
            {data.ledger.entries.length === 0 ? (
              <EmptyState
                title="No ledger entries yet"
                detail="Received purchases and payments will appear here."
              />
            ) : (
              <div className="ga-table-wrap">
                <table className="ga-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Reference</th>
                      <th>Bill / debit</th>
                      <th>Paid / credit</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ledger.entries.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.atLabel}</td>
                        <td>{entry.typeLabel}</td>
                        <td>
                          {entry.referenceHref ? (
                            <Link to={entry.referenceHref}>{entry.reference}</Link>
                          ) : (
                            entry.reference
                          )}
                          {entry.paymentMethodLabel ? (
                            <div className="ga-purchasing__muted">
                              {entry.paymentMethodLabel}
                            </div>
                          ) : null}
                        </td>
                        <td>{entry.debitLabel}</td>
                        <td>{entry.creditLabel}</td>
                        <td>{entry.balanceLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="ga-purchasing__card">
            <div className="ga-purchasing__card-head">
              <h2>Payment history</h2>
            </div>
            {data.payments.length === 0 ? (
              <EmptyState
                title="No payments yet"
                detail="Record a payment when you pay this supplier."
              />
            ) : (
              <div className="ga-table-wrap">
                <table className="ga-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Reference</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{payment.paymentDateLabel}</td>
                        <td>{payment.amountLabel}</td>
                        <td>{payment.paymentMethodLabel}</td>
                        <td>{payment.referenceNumber ?? '—'}</td>
                        <td>
                          {canManage ? (
                            <Button
                              variant="ghost"
                              disabled={deletePayment.isPending}
                              onClick={() => {
                                setDeleteError(null);
                                deletePayment.mutate(
                                  {
                                    paymentId: payment.id,
                                    supplierId: data.supplier.id,
                                  },
                                  {
                                    onError: (err) =>
                                      setDeleteError(
                                        formatMutationError(
                                          err,
                                          'Could not delete payment',
                                        ),
                                      ),
                                  },
                                );
                              }}
                            >
                              Delete
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {deleteError ? (
              <p className="ga-purchasing__note">{deleteError}</p>
            ) : null}
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
          {canManage ? (
            <SupplierPaymentModal
              open={payOpen}
              onClose={closePay}
              supplierId={data.supplier.id}
              supplierName={data.supplier.name}
              outstandingLabel={data.ledger.outstandingLabel}
              purchases={data.purchases}
            />
          ) : null}
        </div>
      )}
    </QueryStateGate>
  );
}
