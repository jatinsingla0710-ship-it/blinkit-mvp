import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usePermissions } from '@groaurum/auth/react';
import { CustomerFormModal } from '@/components/customers/CustomerFormModal';
import { CustomersListToolbar } from '@/components/customers/CustomersListToolbar';
import { CustomersTable } from '@/components/customers/CustomersTable';
import { KpiCards } from '@/components/dashboard/KpiCards';
import { QueryStateGate } from '@/data/QueryStateGate';
import {
  filterCustomerRows,
  type CustomerListStatusFilter,
} from '@/data/customer-list-filters';
import { useCustomersSnapshotQuery } from '@/data/hooks';
import './CustomersListPage.css';

export function CustomersListPage() {
  const { state } = useCustomersSnapshotQuery();
  const { hasPermission } = usePermissions();
  const canManageCustomers = hasPermission('customers:manage');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const digitalFilter = searchParams.get('digital');
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<CustomerListStatusFilter>('all');

  const filteredRows = useMemo(() => {
    if (!state.data) return [];
    let rows = state.data.rows;
    if (digitalFilter === 'not_activated') {
      rows = rows.filter((row) => row.digitalAccess === 'not_activated');
    } else if (digitalFilter === 'app_link_sent') {
      rows = rows.filter((row) => row.digitalAccess === 'app_link_sent');
    }
    return filterCustomerRows(rows, search, statusFilter);
  }, [state.data, digitalFilter, search, statusFilter]);

  return (
    <QueryStateGate title="Customers" state={state}>
      {(snapshot) => (
        <div className="ga-cust-list">
          <header className="ga-cust-list__header">
            <div>
              <h1 className="ga-cust-list__title">Customers</h1>
              <p className="ga-cust-list__subtitle">
                Retail network — business operations and app access
              </p>
            </div>
          </header>

          <KpiCards items={snapshot.kpis} />

          {digitalFilter === 'not_activated' ? (
            <p className="ga-cust-list__filter-note">
              Showing customers who have not logged into the Customer App.{' '}
              <Link to="/customers">Show all</Link>
            </p>
          ) : null}
          {digitalFilter === 'app_link_sent' ? (
            <p className="ga-cust-list__filter-note">
              Showing customers who received the app link but have not logged in
              yet. <Link to="/customers">Show all</Link>
            </p>
          ) : null}

          <CustomersListToolbar
            search={search}
            status={statusFilter}
            onSearchChange={setSearch}
            onStatusChange={setStatusFilter}
            onAdd={
              canManageCustomers ? () => setCreateOpen(true) : undefined
            }
          />

          <CustomersTable rows={filteredRows} />

          {canManageCustomers ? (
            <CustomerFormModal
              open={createOpen}
              onClose={() => setCreateOpen(false)}
              locationHints={snapshot.createDefaults}
              onSuccess={(customerId) => navigate(`/customers/${customerId}`)}
            />
          ) : null}
        </div>
      )}
    </QueryStateGate>
  );
}
