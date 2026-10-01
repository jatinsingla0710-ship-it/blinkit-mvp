import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePermissions } from '@groaurum/auth/react';
import { CustomerAccountBusinessInfo } from '@/components/customers/account/CustomerAccountBusinessInfo';
import { CustomerAccountRecentOrders } from '@/components/customers/account/CustomerAccountOrders';
import { CustomerAccountHeader } from '@/components/customers/account/CustomerAccountHeader';
import { CustomerAccountNeedsAttention } from '@/components/customers/account/CustomerAccountNeedsAttention';
import { CustomerAccountSummaryCards } from '@/components/customers/account/CustomerAccountSummaryCards';
import { CustomerAccountTimeline } from '@/components/customers/account/CustomerAccountTimeline';
import { CustomerActivityTab } from '@/components/customers/CustomerActivityTab';
import { CustomerAddressesTab } from '@/components/customers/CustomerAddressesTab';
import { CustomerDocumentsTab } from '@/components/customers/CustomerDocumentsTab';
import { CustomerLedgerPanel } from '@/components/customers/CustomerLedgerPanel';
import { CustomerOrdersTab } from '@/components/customers/CustomerOrdersTab';
import { CustomerPaymentsTab } from '@/components/customers/CustomerPaymentsTab';
import { SalesmanReassignModal } from '@/components/customers/SalesmanReassignModal';
import { CustomerEditModal } from '@/components/customers/CustomerEditModal';
import { Card } from '@/components/ui/Card';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useCustomerDetailQuery } from '@/data/hooks';
import './CustomerDetailPage.css';

/**
 * Customer detail — business relationship view.
 * Hierarchy: Header → Money summary → Attention → Ledger → Recent activity → Details.
 * Reuses Phase 3A ledger; no second balance source.
 */
export function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const [reassignOpen, setReassignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { state } = useCustomerDetailQuery(customerId);
  const { hasPermission } = usePermissions();
  const canManageCustomers = hasPermission('customers:manage');

  return (
    <QueryStateGate
      title="Customer"
      state={state}
      emptyTitle="Customer not found"
      emptyDetail="Return to Customers and select a shop."
    >
      {(customer) => (
        <div className="ga-cust-account">
          <CustomerAccountHeader
            customer={customer}
            canManage={canManageCustomers}
            onEdit={() => setEditOpen(true)}
            onReassign={() => setReassignOpen(true)}
          />

          <CustomerAccountSummaryCards
            summary={customer.summary}
            shopName={customer.shopName}
            totalSalesLabel={customer.ledger.totalSalesLabel}
            totalPaidLabel={customer.ledger.totalPaidLabel}
            outstandingLabel={customer.ledger.outstandingLabel}
            outstanding={customer.ledger.outstanding}
          />

          <CustomerAccountNeedsAttention items={customer.attentionItems} />

          <div className="ga-cust-account__layout">
            <div className="ga-cust-account__main">
              <Card
                id="ledger"
                title="Account ledger"
                className="ga-cust-account-card"
              >
                <p className="ga-cust-account__ledger-intro">
                  Sales (debit) and payments (credit) for {customer.shopName},
                  newest first.
                </p>
                <CustomerLedgerPanel
                  ledger={customer.ledger}
                  shopName={customer.shopName}
                />
              </Card>

              <CustomerAccountRecentOrders
                orders={customer.orders}
                shopName={customer.shopName}
              />

              <Card id="orders" title="All orders" className="ga-cust-account-card">
                <CustomerOrdersTab rows={customer.orders} />
              </Card>

              <Card id="payments" title="Payments" className="ga-cust-account-card">
                <CustomerPaymentsTab rows={customer.payments} />
              </Card>

              <Card title="Addresses" className="ga-cust-account-card">
                <CustomerAddressesTab rows={customer.addresses} />
              </Card>

              <Card title="Activity" className="ga-cust-account-card">
                <CustomerActivityTab rows={customer.activity} deferred />
              </Card>

              {customer.documents.length > 0 ? (
                <Card title="Documents" className="ga-cust-account-card">
                  <CustomerDocumentsTab rows={customer.documents} deferred />
                </Card>
              ) : null}
            </div>

            <aside className="ga-cust-account__side">
              <CustomerAccountBusinessInfo
                customer={customer}
                onEdit={() => setEditOpen(true)}
                canManage={canManageCustomers}
              />
              <CustomerAccountTimeline events={customer.timeline} />
            </aside>
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
        </div>
      )}
    </QueryStateGate>
  );
}
