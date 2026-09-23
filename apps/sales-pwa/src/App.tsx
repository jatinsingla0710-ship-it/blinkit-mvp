import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedSalesRoute } from '@/auth/guards';
import { SalesShell } from '@/layout/SalesShell';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { CustomerDetailPage } from '@/pages/CustomerDetailPage';
import { CreateCustomerPage } from '@/pages/CreateCustomerPage';
import { CreateOrderPage } from '@/pages/CreateOrderPage';
import { VisitsPage } from '@/pages/VisitsPage';
import { PerformancePage } from '@/pages/PerformancePage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedSalesRoute>
            <SalesShell />
          </ProtectedSalesRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/new" element={<CreateCustomerPage />} />
        <Route path="customers/:shopId" element={<CustomerDetailPage />} />
        <Route path="orders/new" element={<CreateOrderPage />} />
        <Route path="visits" element={<VisitsPage />} />
        <Route path="performance" element={<PerformancePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
