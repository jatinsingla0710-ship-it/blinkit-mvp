import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePermissions } from '@groaurum/auth/react';
import { Button } from '@groaurum/ui';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { CodSettlementsPanel } from '@/components/payments/CodSettlementsPanel';
import { SALES_SECTION_LINKS } from '@/data/section-links';
import {
  useCodCustodySummariesQuery,
  usePaymentsListQuery,
  usePaymentsOverviewQuery,
} from '@/data/hooks';
import {
  useVerifyReportedPaymentMutation,
  useRejectReportedPaymentMutation,
} from '@/data/mutations';
import { formatMutationError } from '@/data/mutation-errors';
import type { PaymentListRow, PaymentsTabId } from '@/data/payments-types';
import { isReportedDigitalAwaitingVerification } from '@/data/payments-recon';
import '@groaurum/ui/styles/data-table.css';
import './PaymentsPage.css';

const TABS: TabItem<PaymentsTabId>[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'all', label: 'All Payments' },
  { id: 'cash', label: 'Cash / COD' },
  { id: 'online', label: 'Online / UPI' },
  { id: 'settlements', label: 'Settlements' },
  { id: 'reconciliation', label: 'Reconciliation' },
];

function parseTab(raw: string | null): PaymentsTabId {
  const id = (raw ?? 'overview') as PaymentsTabId;
  return TABS.some((t) => t.id === id) ? id : 'overview';
}

/**
 * Payments hub — overview, ledger, COD custody, online recon, settlements.
 * Customer payment ≠ Admin settlement.
 */
export function PaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTab(searchParams.get('tab'));
  const focus = searchParams.get('focus');
  const ofdUnpaidOnly = focus === 'ofd_unpaid';
  const withManagerFocus = focus === 'with_manager';
  const withDriverFocus = focus === 'with_driver';
  const setTab = (next: PaymentsTabId) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    if (next !== 'all' && next !== 'settlements') {
      params.delete('focus');
    }
    setSearchParams(params, { replace: true });
  };

  const { hasPermission } = usePermissions();
  const canManage = hasPermission('payments:manage');

  const overview = usePaymentsOverviewQuery();
  const allPayments = usePaymentsListQuery({ ofdUnpaidOnly });
  const onlinePayments = usePaymentsListQuery({ onlineOnly: true });
  const cashPayments = usePaymentsListQuery({ cashOnly: true });
  const custody = useCodCustodySummariesQuery();

  const settleInitialStage =
    withManagerFocus ? 'with_manager' : withDriverFocus ? 'with_driver' : 'with_driver';


  return (
    <div className="ga-payments-page">
      <PageHeader
        title="Collections"
        subtitle="Customer payments, COD custody, and settlements"
        meta={
          overview.data
            ? `As of ${overview.data.asOfDate}${canManage ? '' : ' · read-only'}`
            : canManage
              ? undefined
              : 'Read-only'
        }
      />

      <SectionRelatedLinks
        label="Sales section"
        links={[...SALES_SECTION_LINKS]}
      />

      <Card>
        <p className="ga-payments-page__callout">
          Customer paid ≠ cash received by the company. Use Cash / COD and
          Settlements to track delivery cash until Owner confirms.
        </p>
        <Tabs items={TABS} active={tab} onChange={setTab} />

        <div className="ga-payments-page__panel">
          {tab === 'overview' ? (
            overview.isPending ? (
              <p>Loading overview…</p>
            ) : overview.isError ? (
              <p className="ga-payments-page__error">
                {overview.error instanceof Error
                  ? overview.error.message
                  : 'Could not load payments overview'}
              </p>
            ) : overview.data ? (
              <div className="ga-payments-page__kpi-grid">
                <div>
                  <p className="ga-payments-page__kpi-label">Sales today</p>
                  <p className="ga-payments-page__kpi-value">
                    {overview.data.salesLabel}
                  </p>
                </div>
                <div>
                  <p className="ga-payments-page__kpi-label">Received</p>
                  <p className="ga-payments-page__kpi-value">
                    {overview.data.receivedLabel}
                  </p>
                </div>
                <div>
                  <p className="ga-payments-page__kpi-label">
                    Pending customer payment
                  </p>
                  <p className="ga-payments-page__kpi-value">
                    {overview.data.pendingCustomerPaymentLabel}
                  </p>
                </div>
                <div>
                  <p className="ga-payments-page__kpi-label">With delivery boys</p>
                  <p className="ga-payments-page__kpi-value">
                    {overview.data.withDeliveryBoysLabel}
                  </p>
                </div>
                <div>
                  <p className="ga-payments-page__kpi-label">Settled to company</p>
                  <p className="ga-payments-page__kpi-value">
                    {overview.data.settledToCompanyLabel}
                  </p>
                </div>
                <div>
                  <p className="ga-payments-page__kpi-label">Online / Cash</p>
                  <p className="ga-payments-page__kpi-value">
                    {overview.data.onlineLabel} / {overview.data.cashLabel}
                  </p>
                </div>
              </div>
            ) : (
              <EmptyState title="No overview" detail="No payments data yet." />
            )
          ) : null}

          {tab === 'all' ? (
            <>
              {ofdUnpaidOnly ? (
                <p className="ga-payments-page__banner">
                  Filtered: customer unpaid residual on out-for-delivery orders
                  (Dashboard Card 5).
                </p>
              ) : null}
              <PaymentsTable
                rows={allPayments.data ?? []}
                loading={allPayments.isPending}
                error={allPayments.error}
                emptyTitle={
                  ofdUnpaidOnly
                    ? 'No unpaid out-for-delivery payments'
                    : 'No payments'
                }
                emptyDetail={
                  ofdUnpaidOnly
                    ? 'No OFD orders with outstanding customer payment.'
                    : 'Payment rows appear when orders are created.'
                }
              />
            </>
          ) : null}

          {tab === 'cash' ? (
            <>
              <div className="ga-payments-page__kpi-grid ga-payments-page__kpi-grid--compact">
                <div>
                  <p className="ga-payments-page__kpi-label">With drivers</p>
                  <p className="ga-payments-page__kpi-value">
                    {overview.data?.withDeliveryBoysLabel ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="ga-payments-page__kpi-label">Cash paid today</p>
                  <p className="ga-payments-page__kpi-value">
                    {overview.data?.cashLabel ?? '—'}
                  </p>
                </div>
              </div>
              <PaymentsTable
                rows={cashPayments.data ?? []}
                loading={cashPayments.isPending}
                error={cashPayments.error}
                emptyTitle="No COD / cash payments"
                emptyDetail="Pay-on-delivery payments will appear here."
              />
              <h3 className="ga-payments-page__subhead">COD custody</h3>
              {(custody.data ?? []).length === 0 ? (
                <EmptyState
                  title="No custody balances"
                  detail="Cash collected by drivers shows here until settled."
                />
              ) : (
                <div className="ga-table-wrap">
                  <table className="ga-table">
                    <thead>
                      <tr>
                        <th>Driver</th>
                        <th>Pending Admin</th>
                        <th>Orders</th>
                        <th>Settled</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(custody.data ?? []).map((c) => (
                        <tr key={c.deliveryProfileId}>
                          <td>{c.driverName}</td>
                          <td>{c.withDriverLabel}</td>
                          <td>{c.orderCount}</td>
                          <td>{c.adminSettledLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}

          {tab === 'online' ? (
            <>
              {overview.data && !overview.data.paymentBankConfirmationConfigured ? (
                <p className="ga-payments-page__banner">
                  Online / dynamic QR provider is not configured yet. Do not treat
                  unpaid online as paid. Per-row status uses provider reference
                  evidence only.
                </p>
              ) : null}
              <PaymentsTable
                rows={onlinePayments.data ?? []}
                loading={onlinePayments.isPending}
                error={onlinePayments.error}
                emptyTitle="No online / bank payments"
                emptyDetail="PAY_ONLINE_NOW, UPI, bank transfer, and reported digital payments appear here."
                showProvider
                showRecon
                canManage={canManage}
              />
            </>
          ) : null}

          {tab === 'settlements' ? (
            <>
              {withManagerFocus ? (
                <p className="ga-payments-page__banner">
                  Dashboard focus: cash currently{' '}
                  <strong>Received by Manager</strong> — awaiting Owner
                  confirmation.
                </p>
              ) : null}
              {withDriverFocus ? (
                <p className="ga-payments-page__banner">
                  Dashboard focus: cash still <strong>With Delivery Boy</strong>{' '}
                  (Card 6 — Delivery Collections Pending).
                </p>
              ) : null}
              <CodSettlementsPanel
                key={settleInitialStage}
                canManage={canManage}
                initialStage={settleInitialStage}
                showManagerWarehouseBreakdown={withManagerFocus}
              />
            </>
          ) : null}

          {tab === 'reconciliation' ? (
            <>
              <p className="ga-payments-page__banner">
                Mismatch only when both sides exist. We never invent bank rows —
                MATCHED requires PAID + provider_reference.
              </p>
              <PaymentsTable
                rows={onlinePayments.data ?? []}
                loading={onlinePayments.isPending}
                error={onlinePayments.error}
                emptyTitle="No online payments to reconcile"
                emptyDetail="Online payments with provider evidence appear here."
                showProvider
                showRecon
              />
            </>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function PaymentsTable({
  rows,
  loading,
  error,
  emptyTitle,
  emptyDetail,
  showProvider,
  showRecon,
  canManage,
}: {
  rows: PaymentListRow[];
  loading: boolean;
  error: unknown;
  emptyTitle: string;
  emptyDetail: string;
  showProvider?: boolean;
  showRecon?: boolean;
  canManage?: boolean;
}) {
  const verify = useVerifyReportedPaymentMutation();
  const reject = useRejectReportedPaymentMutation();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionOk, setActionOk] = useState<string | null>(null);

  if (loading) return <p>Loading payments…</p>;
  if (error) {
    return (
      <p className="ga-payments-page__error">
        {error instanceof Error ? error.message : 'Could not load payments'}
      </p>
    );
  }
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} detail={emptyDetail} />;
  }
  return (
    <div className="ga-table-wrap">
      {actionError ? (
        <p className="ga-payments-page__error">{actionError}</p>
      ) : null}
      {actionOk ? <p className="ga-payments-page__note">{actionOk}</p> : null}
      <table className="ga-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Cash</th>
            <th>Online</th>
            <th>Customer payment</th>
            <th>Method</th>
            <th>Collected by</th>
            <th>Custody</th>
            <th>Settlement</th>
            {showProvider ? <th>Provider ref</th> : null}
            {showRecon ? <th>Recon</th> : null}
            <th>Created</th>
            <th>Settled</th>
            {canManage ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const awaiting = isReportedDigitalAwaitingVerification({
              status: row.status,
              collectionMethod: row.collectionMethod,
            });
            return (
              <tr key={row.id}>
                <td className="ga-table__mono">
                  <Link to={`/orders/${row.orderId}`}>{row.orderCode}</Link>
                </td>
                <td>{row.shopName}</td>
                <td>{row.amountLabel}</td>
                <td>{row.cashCollectedLabel}</td>
                <td>{row.onlineCollectedLabel}</td>
                <td>{row.customerPaymentLabel}</td>
                <td>{row.methodLabel}</td>
                <td>{row.collectedByLabel}</td>
                <td>{row.custodyStatusLabel}</td>
                <td>{row.settlementStatusLabel}</td>
                {showProvider ? (
                  <td className="ga-table__mono">
                    {row.providerReference || '—'}
                  </td>
                ) : null}
                {showRecon ? <td>{row.reconciliationLabel}</td> : null}
                <td>{row.createdAtLabel}</td>
                <td>{row.settledAtLabel}</td>
                {canManage ? (
                  <td>
                    {awaiting ? (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <Button
                          variant="primary"
                          disabled={verify.isPending || reject.isPending}
                          onClick={() => {
                            setActionError(null);
                            setActionOk(null);
                            verify.mutate(
                              { orderId: row.orderId },
                              {
                                onSuccess: () =>
                                  setActionOk(
                                    `Verified ${row.orderCode} · marked PAID`,
                                  ),
                                onError: (err) =>
                                  setActionError(
                                    formatMutationError(
                                      err,
                                      'Could not verify payment',
                                    ),
                                  ),
                              },
                            );
                          }}
                        >
                          Verify Payment
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={verify.isPending || reject.isPending}
                          onClick={() => {
                            setActionError(null);
                            setActionOk(null);
                            reject.mutate(
                              { orderId: row.orderId },
                              {
                                onSuccess: () =>
                                  setActionOk(
                                    `Rejected ${row.orderCode} · back to unpaid`,
                                  ),
                                onError: (err) =>
                                  setActionError(
                                    formatMutationError(
                                      err,
                                      'Could not reject payment',
                                    ),
                                  ),
                              },
                            );
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
