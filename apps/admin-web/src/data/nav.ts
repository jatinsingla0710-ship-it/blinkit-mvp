import type { NavItem } from '@/data/dashboard-types';

/** Static admin ERP navigation — not fixture business data. */
export const SIDEBAR_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/' },
  { id: 'orders', label: 'Orders', path: '/orders' },
  { id: 'sales', label: 'Sales', path: '/sales' },
  { id: 'customers', label: 'Customers', path: '/customers' },
  { id: 'products', label: 'Products', path: '/products' },
  { id: 'categories', label: 'Categories', path: '/categories' },
  { id: 'pricing', label: 'Pricing', path: '/pricing' },
  { id: 'commission', label: 'Commission', path: '/pricing/commission' },
  { id: 'inventory', label: 'Inventory', path: '/inventory' },
  { id: 'salesmen', label: 'Salesmen', path: '/salesmen' },
  { id: 'delivery', label: 'Delivery', path: '/delivery' },
  { id: 'payments', label: 'Payments', path: '/payments' },
  { id: 'service-areas', label: 'Service Areas', path: '/service-areas' },
  { id: 'warehouses', label: 'Warehouses', path: '/warehouses' },
  { id: 'reports', label: 'Reports', path: '/reports' },
  { id: 'settings', label: 'Settings', path: '/settings' },
];
