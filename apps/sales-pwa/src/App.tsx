import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedSalesRoute } from '@/auth/guards';
import { SetupGate } from '@/auth/SetupGate';
import { SalesShell } from '@/layout/SalesShell';
import { AppUpdateBanner } from '@/components/AppUpdateBanner';
import { LoginPage } from '@/pages/LoginPage';

const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const CustomersPage = lazy(() =>
  import('@/pages/CustomersPage').then((m) => ({ default: m.CustomersPage })),
);
const CustomerDetailPage = lazy(() =>
  import('@/pages/CustomerDetailPage').then((m) => ({ default: m.CustomerDetailPage })),
);
const CreateCustomerPage = lazy(() =>
  import('@/pages/CreateCustomerPage').then((m) => ({ default: m.CreateCustomerPage })),
);
const CreateOrderPage = lazy(() =>
  import('@/pages/CreateOrderPage').then((m) => ({ default: m.CreateOrderPage })),
);
const OrdersPage = lazy(() =>
  import('@/pages/OrdersPage').then((m) => ({ default: m.OrdersPage })),
);
const OrderDetailPage = lazy(() =>
  import('@/pages/OrderDetailPage').then((m) => ({ default: m.OrderDetailPage })),
);
const VisitsPage = lazy(() =>
  import('@/pages/VisitsPage').then((m) => ({ default: m.VisitsPage })),
);
const PerformancePage = lazy(() =>
  import('@/pages/PerformancePage').then((m) => ({ default: m.PerformancePage })),
);
const ProfilePage = lazy(() =>
  import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const ProfileSetupPage = lazy(() =>
  import('@/pages/ProfileSetupPage').then((m) => ({ default: m.ProfileSetupPage })),
);
const ExpensesPage = lazy(() =>
  import('@/pages/ExpensesPage').then((m) => ({ default: m.ExpensesPage })),
);
const ExpenseFormPage = lazy(() =>
  import('@/pages/ExpenseFormPage').then((m) => ({ default: m.ExpenseFormPage })),
);
const ExpenseDetailPage = lazy(() =>
  import('@/pages/ExpenseDetailPage').then((m) => ({ default: m.ExpenseDetailPage })),
);
const ReturnsPage = lazy(() =>
  import('@/pages/ReturnsPage').then((m) => ({ default: m.ReturnsPage })),
);
const ReturnDetailPage = lazy(() =>
  import('@/pages/ReturnDetailPage').then((m) => ({ default: m.ReturnDetailPage })),
);
const ReturnFormPage = lazy(() =>
  import('@/pages/ReturnFormPage').then((m) => ({ default: m.ReturnFormPage })),
);
const MessagesPage = lazy(() =>
  import('@/pages/MessagesPage').then((m) => ({ default: m.MessagesPage })),
);
const NoticesPage = lazy(() =>
  import('@/pages/NoticesPage').then((m) => ({ default: m.NoticesPage })),
);

export function AppRoutes() {
  return (
    <>
      <AppUpdateBanner />
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedSalesRoute>
            <SalesShell />
          </ProtectedSalesRoute>
        }
      >
        <Route element={<SetupGate />}>
          <Route index element={<DashboardPage />} />
          <Route path="visits" element={<VisitsPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/new" element={<CreateOrderPage />} />
          <Route path="orders/:orderId/return" element={<ReturnFormPage />} />
          <Route path="orders/:orderId" element={<OrderDetailPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="customers/new" element={<CreateCustomerPage />} />
          <Route path="customers/:shopId/return" element={<ReturnFormPage />} />
          <Route path="customers/:shopId" element={<CustomerDetailPage />} />
          <Route path="setup" element={<ProfileSetupPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profile/earnings" element={<PerformancePage />} />
          <Route path="profile/expenses" element={<ExpensesPage />} />
          <Route path="profile/expenses/new" element={<ExpenseFormPage />} />
          <Route path="profile/expenses/:expenseId" element={<ExpenseDetailPage />} />
          <Route path="profile/returns" element={<ReturnsPage />} />
          <Route path="profile/messages" element={<MessagesPage />} />
          <Route path="profile/notices" element={<NoticesPage />} />
          <Route path="profile/returns/:requestId" element={<ReturnDetailPage />} />
          <Route path="performance" element={<Navigate to="/profile/earnings" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
    </>
  );
}
