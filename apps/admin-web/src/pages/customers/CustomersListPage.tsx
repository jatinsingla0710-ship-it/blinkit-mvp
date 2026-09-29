import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<CustomerListStatusFilter>('all');

  const filteredRows = useMemo(() => {
    if (!state.data) return [];
    return filterCustomerRows(state.data.rows, search, statusFilter);
  }, [state.data, search, statusFilter]);

  return (
    <QueryStateGate title="Customers" state={state}>
      {(snapshot) => (
        <div className="ga-cust-list">
          <header className="ga-cust-list__header">
            <div>
              <h1 className="ga-cust-list__title">Customers</h1>
              <p className="ga-cust-list__subtitle">
                Shops your team sells to
              </p>
            </div>
          </header>

          <KpiCards items={snapshot.kpis} />

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
