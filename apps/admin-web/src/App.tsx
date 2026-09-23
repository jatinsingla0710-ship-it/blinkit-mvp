import { lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import type { AdminModule } from '@groaurum/auth';
import {
  AdminModuleGuard,
  ProtectedAdminRoute,
} from '@/auth/guards';
import { AdminShell } from '@/layout/AdminShell';
import { LoginPage } from '@/pages/LoginPage';

const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/settings/SettingsPage').then((m) => ({
    default: m.SettingsPage,
  })),
);
const ServiceAreasListPage = lazy(() =>
  import('@/pages/service-areas/ServiceAreasListPage').then((m) => ({
    default: m.ServiceAreasListPage,
  })),
);
const WarehousesListPage = lazy(() =>
  import('@/pages/warehouses/WarehousesListPage').then((m) => ({
    default: m.WarehousesListPage,
  })),
);
const CategoriesListPage = lazy(() =>
  import('@/pages/categories/CategoriesListPage').then((m) => ({
    default: m.CategoriesListPage,
  })),
);
const CategoryDetailPage = lazy(() =>
  import('@/pages/categories/CategoryDetailPage').then((m) => ({
    default: m.CategoryDetailPage,
  })),
);
const CustomerDetailPage = lazy(() =>
  import('@/pages/customers/CustomerDetailPage').then((m) => ({
    default: m.CustomerDetailPage,
  })),
);
const CustomersListPage = lazy(() =>
  import('@/pages/customers/CustomersListPage').then((m) => ({
    default: m.CustomersListPage,
  })),
);
const InventoryDetailPage = lazy(() =>
  import('@/pages/inventory/InventoryDetailPage').then((m) => ({
    default: m.InventoryDetailPage,
  })),
);
const InventoryListPage = lazy(() =>
  import('@/pages/inventory/InventoryListPage').then((m) => ({
    default: m.InventoryListPage,
  })),
);
const OrderDetailPage = lazy(() =>
  import('@/pages/orders/OrderDetailPage').then((m) => ({
    default: m.OrderDetailPage,
  })),
);
const OrdersListPage = lazy(() =>
  import('@/pages/orders/OrdersListPage').then((m) => ({
    default: m.OrdersListPage,
  })),
);
const SalesListPage = lazy(() =>
  import('@/pages/sales/SalesListPage').then((m) => ({
    default: m.SalesListPage,
  })),
);
const SaleDetailPage = lazy(() =>
  import('@/pages/sales/SaleDetailPage').then((m) => ({
    default: m.SaleDetailPage,
  })),
);
const ProductDetailPage = lazy(() =>
  import('@/pages/products/ProductDetailPage').then((m) => ({
    default: m.ProductDetailPage,
  })),
);
const ProductListPage = lazy(() =>
  import('@/pages/products/ProductListPage').then((m) => ({
    default: m.ProductListPage,
  })),
);
const PricingDetailPage = lazy(() =>
  import('@/pages/pricing/PricingDetailPage').then((m) => ({
    default: m.PricingDetailPage,
  })),
);
const CommissionListPage = lazy(() =>
  import('@/pages/pricing/CommissionListPage').then((m) => ({
    default: m.CommissionListPage,
  })),
);
const PricingListPage = lazy(() =>
  import('@/pages/pricing/PricingListPage').then((m) => ({
    default: m.PricingListPage,
  })),
);
const DeliveryDetailPage = lazy(() =>
  import('@/pages/delivery/DeliveryDetailPage').then((m) => ({
    default: m.DeliveryDetailPage,
  })),
);
const DeliveryListPage = lazy(() =>
  import('@/pages/delivery/DeliveryListPage').then((m) => ({
    default: m.DeliveryListPage,
  })),
);
const DeliveryBoysListPage = lazy(() =>
  import('@/pages/delivery/DeliveryBoysListPage').then((m) => ({
    default: m.DeliveryBoysListPage,
  })),
);
const DeliveryBoyDetailPage = lazy(() =>
  import('@/pages/delivery/DeliveryBoyDetailPage').then((m) => ({
    default: m.DeliveryBoyDetailPage,
  })),
);
const VehiclesListPage = lazy(() =>
  import('@/pages/delivery/VehiclesListPage').then((m) => ({
    default: m.VehiclesListPage,
  })),
);
const PaymentsPage = lazy(() =>
  import('@/pages/payments/PaymentsPage').then((m) => ({
    default: m.PaymentsPage,
  })),
);
const ReportsPage = lazy(() =>
  import('@/pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);
const SalesmanDetailPage = lazy(() =>
  import('@/pages/salesmen/SalesmanDetailPage').then((m) => ({
    default: m.SalesmanDetailPage,
  })),
);
const SalesmenListPage = lazy(() =>
  import('@/pages/salesmen/SalesmenListPage').then((m) => ({
    default: m.SalesmenListPage,
  })),
);

function guard(module: AdminModule, page: ReactNode) {
  return <AdminModuleGuard module={module}>{page}</AdminModuleGuard>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedAdminRoute>
            <AdminShell />
          </ProtectedAdminRoute>
        }
      >
        <Route index element={guard('dashboard', <DashboardPage />)} />
        <Route path="orders" element={guard('orders', <OrdersListPage />)} />
        <Route
          path="orders/:orderId"
          element={guard('orders', <OrderDetailPage />)}
        />
        <Route path="sales" element={guard('orders', <SalesListPage />)} />
        <Route
          path="sales/:saleId"
          element={guard('orders', <SaleDetailPage />)}
        />
        <Route
          path="customers"
          element={guard('customers', <CustomersListPage />)}
        />
        <Route
          path="customers/:customerId"
          element={guard('customers', <CustomerDetailPage />)}
        />
        <Route
          path="products"
          element={guard('products', <ProductListPage />)}
        />
        <Route
          path="products/:productId"
          element={guard('products', <ProductDetailPage />)}
        />
        <Route
          path="categories"
          element={guard('categories', <CategoriesListPage />)}
        />
        <Route
          path="categories/:categoryId"
          element={guard('categories', <CategoryDetailPage />)}
        />
        <Route path="pricing" element={guard('pricing', <PricingListPage />)} />
        <Route
          path="pricing/commission"
          element={guard('pricing', <CommissionListPage />)}
        />
        <Route
          path="pricing/:skuId"
          element={guard('pricing', <PricingDetailPage />)}
        />
        <Route
          path="inventory"
          element={guard('inventory', <InventoryListPage />)}
        />
        <Route
          path="inventory/:skuId"
          element={guard('inventory', <InventoryDetailPage />)}
        />
        <Route
          path="salesmen"
          element={guard('salesmen', <SalesmenListPage />)}
        />
        <Route
          path="salesmen/:salesmanId"
          element={guard('salesmen', <SalesmanDetailPage />)}
        />
        <Route
          path="delivery"
          element={guard('delivery', <DeliveryListPage />)}
        />
        <Route
          path="delivery/boys"
          element={guard('delivery', <DeliveryBoysListPage />)}
        />
        <Route
          path="delivery/boys/:boyId"
          element={guard('delivery', <DeliveryBoyDetailPage />)}
        />
        <Route
          path="delivery/vehicles"
          element={guard('delivery', <VehiclesListPage />)}
        />
        <Route
          path="delivery/:routeId"
          element={guard('delivery', <DeliveryDetailPage />)}
        />
        <Route path="payments" element={guard('payments', <PaymentsPage />)} />
        <Route
          path="service-areas"
          element={guard('service_areas', <ServiceAreasListPage />)}
        />
        <Route
          path="warehouses"
          element={guard('warehouses', <WarehousesListPage />)}
        />
        <Route path="reports" element={guard('reports', <ReportsPage />)} />
        <Route path="settings" element={guard('settings', <SettingsPage />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
