/** Related links for Phase 1 parent hubs — keep routes stable, group for UX. */

export const SALES_SECTION_LINKS = [
  {
    to: '/orders',
    label: 'Orders',
    description: 'Open and in-progress orders',
  },
  {
    to: '/sales',
    label: 'Invoices',
    description: 'Completed sales register',
  },
  {
    to: '/payments',
    label: 'Collections',
    description: 'Payments and COD custody',
  },
  {
    to: '/receivables',
    label: 'Receivables',
    description: 'Who still owes money',
  },
] as const;

export const ACCOUNTING_SECTION_LINKS = [
  {
    to: '/receivables',
    label: 'Receivables',
    description: 'Customer balances due',
  },
  {
    to: '/expenses',
    label: 'Expenses',
    description: 'Business money out',
  },
  {
    to: '/day-book',
    label: 'Day Book',
    description: 'Daily money in and out',
  },
  {
    to: '/reports',
    label: 'Reports',
    description: 'Sales, P&L, and payroll',
  },
  {
    to: '/payments',
    label: 'Collections',
    description: 'Record and settle payments',
  },
] as const;

export const PRODUCTS_SECTION_LINKS = [
  {
    to: '/products',
    label: 'Products',
    description: 'Catalogue and SKUs',
  },
  {
    to: '/categories',
    label: 'Categories',
    description: 'Product groups',
  },
  {
    to: '/pricing',
    label: 'Pricing',
    description: 'Trade prices',
  },
] as const;

export const INVENTORY_SECTION_LINKS = [
  {
    to: '/inventory',
    label: 'Stock',
    description: 'On-hand and reserved stock',
  },
  {
    to: '/warehouses',
    label: 'Warehouses',
    description: 'Storage locations',
  },
  {
    to: '/products',
    label: 'Products',
    description: 'Catalogue',
  },
] as const;

export const TEAM_SECTION_LINKS = [
  {
    to: '/salesmen',
    label: 'Salesmen',
    description: 'Field team',
  },
  {
    to: '/salesmen/payroll',
    label: 'Payroll',
    description: 'Monthly salary and commission',
  },
  {
    to: '/pricing/commission',
    label: 'Commission',
    description: 'Per-SKU commission terms',
  },
] as const;

export const SETTINGS_SECTION_LINKS = [
  {
    to: '/settings',
    label: 'Settings',
    description: 'Business configuration',
  },
  {
    to: '/service-areas',
    label: 'Service areas',
    description: 'Coverage territories',
  },
  {
    to: '/warehouses',
    label: 'Warehouses',
    description: 'Storage locations',
  },
] as const;
