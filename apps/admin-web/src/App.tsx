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
const DailyBriefPage = lazy(() =>
  import('@/pages/brief/DailyBriefPage').then((m) => ({
    default: m.DailyBriefPage,
  })),
);
const BusinessChatPage = lazy(() =>
  import('@/pages/ask/BusinessChatPage').then((m) => ({
    default: m.BusinessChatPage,
  })),
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
const NewSalePage = lazy(() =>
  import('@/pages/sales/NewSalePage').then((m) => ({
    default: m.NewSalePage,
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
const PaymentProofUploadPage = lazy(() =>
  import('@/pages/payments/PaymentProofUploadPage').then((m) => ({
    default: m.PaymentProofUploadPage,
  })),
);
const PaymentProofReviewPage = lazy(() =>
  import('@/pages/payments/PaymentProofReviewPage').then((m) => ({
    default: m.PaymentProofReviewPage,
  })),
);
const ReceivablesPage = lazy(() =>
  import('@/pages/receivables/ReceivablesPage').then((m) => ({
    default: m.ReceivablesPage,
  })),
);
const PayablesPage = lazy(() =>
  import('@/pages/payables/PayablesPage').then((m) => ({
    default: m.PayablesPage,
  })),
);
const DuesAssistantPage = lazy(() =>
  import('@/pages/dues/DuesAssistantPage').then((m) => ({
    default: m.DuesAssistantPage,
  })),
);
const ExpensesPage = lazy(() =>
  import('@/pages/expenses/ExpensesPage').then((m) => ({
    default: m.ExpensesPage,
  })),
);
const ExpenseScanUploadPage = lazy(() =>
  import('@/pages/expenses/ExpenseScanUploadPage').then((m) => ({
    default: m.ExpenseScanUploadPage,
  })),
);
const ExpenseScanReviewPage = lazy(() =>
  import('@/pages/expenses/ExpenseScanReviewPage').then((m) => ({
    default: m.ExpenseScanReviewPage,
  })),
);
const ExpenseDetailPage = lazy(() =>
  import('@/pages/expenses/ExpenseDetailPage').then((m) => ({
    default: m.ExpenseDetailPage,
  })),
);
const DayBookPage = lazy(() =>
  import('@/pages/day-book/DayBookPage').then((m) => ({
    default: m.DayBookPage,
  })),
);
const DayBookScanUploadPage = lazy(() =>
  import('@/pages/day-book/DayBookScanUploadPage').then((m) => ({
    default: m.DayBookScanUploadPage,
  })),
);
const DayBookScanReviewPage = lazy(() =>
  import('@/pages/day-book/DayBookScanReviewPage').then((m) => ({
    default: m.DayBookScanReviewPage,
  })),
);
const AccountingPage = lazy(() =>
  import('@/pages/accounting/AccountingPage').then((m) => ({
    default: m.AccountingPage,
  })),
);
const CashBankPage = lazy(() =>
  import('@/pages/cash-bank/CashBankPage').then((m) => ({
    default: m.CashBankPage,
  })),
);
const ReportsPage = lazy(() =>
  import('@/pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);
const ProfitLossPage = lazy(() =>
  import('@/pages/reports/ProfitLossPage').then((m) => ({
    default: m.ProfitLossPage,
  })),
);
const ProfitInsightsPage = lazy(() =>
  import('@/pages/reports/ProfitInsightsPage').then((m) => ({
    default: m.ProfitInsightsPage,
  })),
);
const BalanceSheetPage = lazy(() =>
  import('@/pages/reports/BalanceSheetPage').then((m) => ({
    default: m.BalanceSheetPage,
  })),
);
const CashFlowPage = lazy(() =>
  import('@/pages/reports/CashFlowPage').then((m) => ({
    default: m.CashFlowPage,
  })),
);
const TrialBalancePage = lazy(() =>
  import('@/pages/reports/TrialBalancePage').then((m) => ({
    default: m.TrialBalancePage,
  })),
);
const GeneralLedgerPage = lazy(() =>
  import('@/pages/reports/GeneralLedgerPage').then((m) => ({
    default: m.GeneralLedgerPage,
  })),
);
const GstReportPage = lazy(() =>
  import('@/pages/reports/GstReportPage').then((m) => ({
    default: m.GstReportPage,
  })),
);
const StockValuationReportPage = lazy(() =>
  import('@/pages/reports/StockValuationReportPage').then((m) => ({
    default: m.StockValuationReportPage,
  })),
);
const SalesReportPage = lazy(() =>
  import('@/pages/reports/SalesReportPage').then((m) => ({
    default: m.SalesReportPage,
  })),
);
const CollectionsReportPage = lazy(() =>
  import('@/pages/reports/CollectionsReportPage').then((m) => ({
    default: m.CollectionsReportPage,
  })),
);
const OutstandingReportPage = lazy(() =>
  import('@/pages/reports/OutstandingReportPage').then((m) => ({
    default: m.OutstandingReportPage,
  })),
);
const ExpenseReportPage = lazy(() =>
  import('@/pages/reports/ExpenseReportPage').then((m) => ({
    default: m.ExpenseReportPage,
  })),
);
const PayrollReportPage = lazy(() =>
  import('@/pages/reports/PayrollReportPage').then((m) => ({
    default: m.PayrollReportPage,
  })),
);
const ProductSalesReportPage = lazy(() =>
  import('@/pages/reports/ProductSalesReportPage').then((m) => ({
    default: m.ProductSalesReportPage,
  })),
);
const SalesmanPerformanceReportPage = lazy(() =>
  import('@/pages/reports/SalesmanPerformanceReportPage').then((m) => ({
    default: m.SalesmanPerformanceReportPage,
  })),
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
const SalesmenPayrollPage = lazy(() =>
  import('@/pages/salesmen/SalesmenPayrollPage').then((m) => ({
    default: m.SalesmenPayrollPage,
  })),
);
const SalesmenClaimsPage = lazy(() =>
  import('@/pages/salesmen/SalesmenClaimsPage').then((m) => ({
    default: m.SalesmenClaimsPage,
  })),
);
const PurchasesListPage = lazy(() =>
  import('@/pages/purchases/PurchasesListPage').then((m) => ({
    default: m.PurchasesListPage,
  })),
);
const PurchaseDetailPage = lazy(() =>
  import('@/pages/purchases/PurchaseDetailPage').then((m) => ({
    default: m.PurchaseDetailPage,
  })),
);
const PurchaseFormPage = lazy(() =>
  import('@/pages/purchases/PurchaseFormPage').then((m) => ({
    default: m.PurchaseFormPage,
  })),
);
const PurchaseRecommendPage = lazy(() =>
  import('@/pages/purchases/PurchaseRecommendPage').then((m) => ({
    default: m.PurchaseRecommendPage,
  })),
);
const BillScanUploadPage = lazy(() =>
  import('@/pages/purchases/BillScanUploadPage').then((m) => ({
    default: m.BillScanUploadPage,
  })),
);
const BillScanReviewPage = lazy(() =>
  import('@/pages/purchases/BillScanReviewPage').then((m) => ({
    default: m.BillScanReviewPage,
  })),
);
const SuppliersListPage = lazy(() =>
  import('@/pages/suppliers/SuppliersListPage').then((m) => ({
    default: m.SuppliersListPage,
  })),
);
const SupplierDetailPage = lazy(() =>
  import('@/pages/suppliers/SupplierDetailPage').then((m) => ({
    default: m.SupplierDetailPage,
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
        <Route
          path="brief"
          element={guard('dashboard', <DailyBriefPage />)}
        />
        <Route
          path="ask"
          element={guard('dashboard', <BusinessChatPage />)}
        />
        <Route path="orders" element={guard('orders', <OrdersListPage />)} />
        <Route
          path="orders/:orderId"
          element={guard('orders', <OrderDetailPage />)}
        />
        <Route path="sales" element={guard('orders', <SalesListPage />)} />
        <Route
          path="sales/new"
          element={guard('orders', <NewSalePage />)}
        />
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
          path="salesmen/payroll"
          element={guard('salesmen', <SalesmenPayrollPage />)}
        />
        <Route
          path="salesmen/claims"
          element={guard('salesmen', <SalesmenClaimsPage />)}
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
          path="payments/scan"
          element={guard('payments', <PaymentProofUploadPage />)}
        />
        <Route
          path="payments/scan/:scanId"
          element={guard('payments', <PaymentProofReviewPage />)}
        />
        <Route
          path="receivables"
          element={guard('payments', <ReceivablesPage />)}
        />
        <Route
          path="payables"
          element={guard('payments', <PayablesPage />)}
        />
        <Route
          path="dues"
          element={guard('payments', <DuesAssistantPage />)}
        />
        <Route
          path="purchases"
          element={guard('payments', <PurchasesListPage />)}
        />
        <Route
          path="purchases/recommend"
          element={guard('payments', <PurchaseRecommendPage />)}
        />
        <Route
          path="purchases/scan"
          element={guard('payments', <BillScanUploadPage />)}
        />
        <Route
          path="purchases/scan/:scanId"
          element={guard('payments', <BillScanReviewPage />)}
        />
        <Route
          path="purchases/new"
          element={guard('payments', <PurchaseFormPage />)}
        />
        <Route
          path="purchases/:purchaseId/edit"
          element={guard('payments', <PurchaseFormPage />)}
        />
        <Route
          path="purchases/:purchaseId"
          element={guard('payments', <PurchaseDetailPage />)}
        />
        <Route
          path="suppliers"
          element={guard('payments', <SuppliersListPage />)}
        />
        <Route
          path="suppliers/:supplierId"
          element={guard('payments', <SupplierDetailPage />)}
        />
        <Route path="expenses" element={guard('payments', <ExpensesPage />)} />
        <Route
          path="expenses/scan"
          element={guard('payments', <ExpenseScanUploadPage />)}
        />
        <Route
          path="expenses/scan/:scanId"
          element={guard('payments', <ExpenseScanReviewPage />)}
        />
        <Route
          path="expenses/:expenseId"
          element={guard('payments', <ExpenseDetailPage />)}
        />
        <Route path="day-book" element={guard('payments', <DayBookPage />)} />
        <Route
          path="day-book/scan"
          element={guard('payments', <DayBookScanUploadPage />)}
        />
        <Route
          path="day-book/scan/:scanId"
          element={guard('payments', <DayBookScanReviewPage />)}
        />
        <Route
          path="cash-bank"
          element={guard('payments', <CashBankPage />)}
        />
        <Route
          path="accounting"
          element={guard('payments', <AccountingPage />)}
        />
        <Route
          path="service-areas"
          element={guard('service_areas', <ServiceAreasListPage />)}
        />
        <Route
          path="warehouses"
          element={guard('warehouses', <WarehousesListPage />)}
        />
        <Route path="reports" element={guard('reports', <ReportsPage />)} />
        <Route
          path="reports/profit-insights"
          element={guard('reports', <ProfitInsightsPage />)}
        />
        <Route
          path="reports/profit-loss"
          element={guard('reports', <ProfitLossPage />)}
        />
        <Route
          path="reports/balance-sheet"
          element={guard('reports', <BalanceSheetPage />)}
        />
        <Route
          path="reports/cash-flow"
          element={guard('reports', <CashFlowPage />)}
        />
        <Route
          path="reports/trial-balance"
          element={guard('reports', <TrialBalancePage />)}
        />
        <Route
          path="reports/general-ledger"
          element={guard('reports', <GeneralLedgerPage />)}
        />
        <Route
          path="reports/gst"
          element={guard('reports', <GstReportPage />)}
        />
        <Route
          path="reports/stock"
          element={guard('reports', <StockValuationReportPage />)}
        />
        <Route
          path="reports/sales"
          element={guard('reports', <SalesReportPage />)}
        />
        <Route
          path="reports/collections"
          element={guard('reports', <CollectionsReportPage />)}
        />
        <Route
          path="reports/outstanding"
          element={guard('reports', <OutstandingReportPage />)}
        />
        <Route
          path="reports/expenses"
          element={guard('reports', <ExpenseReportPage />)}
        />
        <Route
          path="reports/payroll"
          element={guard('reports', <PayrollReportPage />)}
        />
        <Route
          path="reports/products"
          element={guard('reports', <ProductSalesReportPage />)}
        />
        <Route
          path="reports/salesmen"
          element={guard('reports', <SalesmanPerformanceReportPage />)}
        />
        <Route path="settings" element={guard('settings', <SettingsPage />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
