import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePermissions } from '@groaurum/auth/react';
import { Card } from '@/components/ui/Card';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { CustomerAccountBusinessInfo } from '@/components/customers/account/CustomerAccountBusinessInfo';
import { CustomerAccountHeader } from '@/components/customers/account/CustomerAccountHeader';
import { CustomerAccountNeedsAttention } from '@/components/customers/account/CustomerAccountNeedsAttention';
import { CustomerAccountSummaryCards } from '@/components/customers/account/CustomerAccountSummaryCards';
import { CustomerAddBillPhotoModal } from '@/components/customers/CustomerAddBillPhotoModal';
import { CustomerBillPhotosPanel } from '@/components/customers/CustomerBillPhotosPanel';
import { CustomerEditModal } from '@/components/customers/CustomerEditModal';
import { CustomerLedgerPanel } from '@/components/customers/CustomerLedgerPanel';
import { CustomerOpeningBalanceModal } from '@/components/customers/CustomerOpeningBalanceModal';
import { CustomerOrdersTab } from '@/components/customers/CustomerOrdersTab';
import { CustomerPaymentsTab } from '@/components/customers/CustomerPaymentsTab';
import { CustomerPrimaryActions } from '@/components/customers/CustomerPrimaryActions';
import { CustomerReceivePaymentModal } from '@/components/customers/CustomerReceivePaymentModal';
import { SalesmanReassignModal } from '@/components/customers/SalesmanReassignModal';
import { QueryStateGate } from '@/data/QueryStateGate';
import {
  useCustomerDetailQuery,
  useCustomerDocumentsQuery,
} from '@/data/hooks';
import { formatMutationError } from '@/data/mutation-errors';
import { useArchiveCustomerMutation } from '@/data/mutations';
import './CustomerDetailPage.css';

type CustomerTab =
  | 'ledger'
  | 'bills'
  | 'sales'
  | 'payments'
  | 'statement';

const TABS: TabItem<CustomerTab>[] = [
  { id: 'ledger', label: 'Ledger' },
  { id: 'bills', label: 'Bills & Photos' },
  { id: 'sales', label: 'Sales' },
  { id: 'payments', label: 'Payments' },
  { id: 'statement', label: 'Statement' },
];

/**
 * Customer 2.0 — accounting-first profile.
 * Primary actions stay outside tabs. Ledger balances come from the existing builder.
 */
export function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<CustomerTab>('ledger');
  const [reassignOpen, setReassignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [openingOpen, setOpeningOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const { state } = useCustomerDetailQuery(customerId);
  const documentsQuery = useCustomerDocumentsQuery(customerId);
  const archiveCustomer = useArchiveCustomerMutation();
  const { hasPermission } = usePermissions();
  const canManageCustomers = hasPermission('customers:manage');

  const tabItems = useMemo(() => {
    const billCount = documentsQuery.data?.length ?? 0;
    return TABS.map((item) =>
      item.id === 'bills' && billCount > 0
        ? { ...item, label: `Bills & Photos (${billCount})` }
        : item,
    );
  }, [documentsQuery.data?.length]);

  const onArchive = async (shopId: string, shopName: string) => {
    const ok = window.confirm(
      `Archive ${shopName}? They will no longer appear in the active customer list. Accounting history is kept.`,
    );
    if (!ok) return;
    setArchiveError(null);
    try {
      await archiveCustomer.mutateAsync(shopId);
      navigate('/customers');
    } catch (err) {
      setArchiveError(formatMutationError(err, 'Could not archive customer'));
    }
  };

  return (
    <QueryStateGate
      title="Customer"
      state={state}
      emptyTitle="Customer not found"
      emptyDetail="Return to Customers and select a customer."
    >
      {(customer) => (
        <div className="ga-cust-account">
          <CustomerAccountHeader
            customer={customer}
            canManage={canManageCustomers}
            onEdit={() => setEditOpen(true)}
            onReassign={() => setReassignOpen(true)}
            onArchive={() => void onArchive(customer.id, customer.shopName)}
          />

          <CustomerAccountSummaryCards
            totalSalesLabel={customer.ledger.totalSalesLabel}
            totalPaidLabel={customer.ledger.totalPaidLabel}
            outstandingLabel={customer.ledger.outstandingLabel}
            outstanding={customer.ledger.outstanding}
            openingBalance={customer.openingBalance}
          />

          <CustomerPrimaryActions
            canManage={canManageCustomers}
            outstanding={customer.ledger.outstanding}
            hasOpening={Boolean(customer.openingBalance)}
            onReceivePayment={() => setReceiveOpen(true)}
            onAddBillPhoto={() => {
              setTab('bills');
              setBillOpen(true);
            }}
            onOpeningBalance={() => setOpeningOpen(true)}
          />

          {archiveError ? (
            <p className="ga-cust-account__error" role="alert">
              {archiveError}
            </p>
          ) : null}

          {customer.attentionItems.length > 0 ? (
            <CustomerAccountNeedsAttention items={customer.attentionItems} />
          ) : null}

          <Card className="ga-cust-account-card ga-cust-account__tabs-card">
            <Tabs items={tabItems} active={tab} onChange={setTab} />
            <div className="ga-cust-account__tab-panel">
              {tab === 'ledger' ? (
                <CustomerLedgerPanel
                  ledger={customer.ledger}
                  shopName={customer.shopName}
                  phoneLabel={customer.phoneLabel}
                  compact
                />
              ) : null}

              {tab === 'bills' ? (
                <CustomerBillPhotosPanel
                  shopId={customer.id}
                  documents={documentsQuery.data ?? []}
                  loading={documentsQuery.isPending}
                  canManage={canManageCustomers}
                  onAdd={() => setBillOpen(true)}
                />
              ) : null}

              {tab === 'sales' ? (
                <CustomerOrdersTab rows={customer.orders} />
              ) : null}

              {tab === 'payments' ? (
                <CustomerPaymentsTab rows={customer.payments} />
              ) : null}

              {tab === 'statement' ? (
                <div className="ga-cust-account__statement">
                  <p className="ga-cust-account__ledger-intro">
                    Print or download a statement from this customer&apos;s
                    ledger. PDF and WhatsApp are not available in this phase.
                  </p>
                  <CustomerLedgerPanel
                    ledger={customer.ledger}
                    shopName={customer.shopName}
                    phoneLabel={customer.phoneLabel}
                    compact
                    showDateFilter
                  />
                </div>
              ) : null}
            </div>
          </Card>

          <div className="ga-cust-account__side-row">
            <CustomerAccountBusinessInfo
              customer={customer}
              onEdit={() => setEditOpen(true)}
              canManage={canManageCustomers}
            />
          </div>

          {customerId && canManageCustomers ? (
            <SalesmanReassignModal
              open={reassignOpen}
              customerId={customerId}
              currentSalesmanProfileId={customer.assignedSalesmanProfileId}
              onClose={() => setReassignOpen(false)}
            />
          ) : null}
          {canManageCustomers ? (
            <CustomerEditModal
              open={editOpen}
              customer={customer}
              onClose={() => setEditOpen(false)}
            />
          ) : null}
          {canManageCustomers ? (
            <CustomerReceivePaymentModal
              open={receiveOpen}
              onClose={() => setReceiveOpen(false)}
              shopId={customer.id}
              shopName={customer.shopName}
              outstanding={customer.ledger.outstanding}
              outstandingLabel={customer.ledger.outstandingLabel}
            />
          ) : null}
          {canManageCustomers ? (
            <CustomerOpeningBalanceModal
              open={openingOpen}
              onClose={() => setOpeningOpen(false)}
              shopId={customer.id}
              shopName={customer.shopName}
              existing={customer.openingBalance}
            />
          ) : null}
          {canManageCustomers ? (
            <CustomerAddBillPhotoModal
              open={billOpen}
              onClose={() => setBillOpen(false)}
              shopId={customer.id}
            />
          ) : null}
        </div>
      )}
    </QueryStateGate>
  );
}
