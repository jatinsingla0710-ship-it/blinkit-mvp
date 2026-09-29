import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePermissions } from '@groaurum/auth/react';
import { CustomerAccountBusinessInfo } from '@/components/customers/account/CustomerAccountBusinessInfo';
import { CustomerAccountCurrentActivity, CustomerAccountRecentOrders } from '@/components/customers/account/CustomerAccountOrders';
import { CustomerAccountHeader } from '@/components/customers/account/CustomerAccountHeader';
import { CustomerAccountNeedsAttention } from '@/components/customers/account/CustomerAccountNeedsAttention';
import { CustomerAccountSalesSummary } from '@/components/customers/account/CustomerAccountSalesSummary';
import { CustomerAccountSummaryCards } from '@/components/customers/account/CustomerAccountSummaryCards';
import { CustomerAccountTimeline } from '@/components/customers/account/CustomerAccountTimeline';
import { CustomerActivityTab } from '@/components/customers/CustomerActivityTab';
import { CustomerAddressesTab } from '@/components/customers/CustomerAddressesTab';
import { CustomerDocumentsTab } from '@/components/customers/CustomerDocumentsTab';
import { CustomerOrdersTab } from '@/components/customers/CustomerOrdersTab';
import { CustomerPaymentsTab } from '@/components/customers/CustomerPaymentsTab';
import { SalesmanReassignModal } from '@/components/customers/SalesmanReassignModal';
import { CustomerEditModal } from '@/components/customers/CustomerEditModal';
import { Card } from '@/components/ui/Card';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useCustomerDetailQuery } from '@/data/hooks';
import './CustomerDetailPage.css';

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
      emptyTitle="Retailer not found"
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

          <CustomerAccountNeedsAttention items={customer.attentionItems} />

          <CustomerAccountSummaryCards
            summary={customer.summary}
            shopName={customer.shopName}
          />

          <div className="ga-cust-account__layout">
            <div className="ga-cust-account__main">
              <CustomerAccountCurrentActivity
                orders={customer.orders}
                shopName={customer.shopName}
              />
              <CustomerAccountRecentOrders
                orders={customer.orders}
                shopName={customer.shopName}
              />

              <Card id="orders" title="All Orders" className="ga-cust-account-card">
                <CustomerOrdersTab rows={customer.orders} />
              </Card>

              <Card id="payments" title="Payments" className="ga-cust-account-card">
                <CustomerPaymentsTab rows={customer.payments} />
              </Card>

              <Card title="Addresses" className="ga-cust-account-card">
                <CustomerAddressesTab rows={customer.addresses} />
              </Card>

              <Card title="Activity Log" className="ga-cust-account-card">
                <CustomerActivityTab rows={customer.activity} deferred />
              </Card>

              {customer.documents.length > 0 ? (
                <Card title="Documents" className="ga-cust-account-card">
                  <CustomerDocumentsTab rows={customer.documents} deferred />
                </Card>
              ) : null}
            </div>

            <aside className="ga-cust-account__side">
              <CustomerAccountSalesSummary
                summary={customer.summary}
                shopName={customer.shopName}
              />
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
