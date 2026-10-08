/** Related links for Phase 1 parent hubs — keep routes stable, group for UX. */

export const SALES_SECTION_LINKS = [
  {
    to: '/sales/new',
    label: 'New Sale',
    description: 'Counter billing — customer, items, payment',
  },
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
    to: '/payments/scan',
    label: 'Payment proof',
    description: 'Upload screenshot → review → mark paid',
  },
] as const;

export const ACCOUNTING_SECTION_LINKS = [
  {
    to: '/brief',
    label: "Today's brief",
    description: 'Yesterday · attention · what to do next',
  },
  {
    to: '/ask',
    label: 'Ask your books',
    description: 'Owner questions answered from typed books tools',
  },
  {
    to: '/dues',
    label: 'Dues assistant',
    description: 'Who owes you / whom to pay — from your books',
  },
  {
    to: '/receivables',
    label: 'Money Due',
    description: 'Customer balances due',
  },
  {
    to: '/payables',
    label: 'Money to Pay',
    description: 'Supplier balances to pay',
  },
  {
    to: '/purchases/recommend',
    label: 'What to buy',
    description: 'Suggested purchases from stock and sales',
  },
  {
    to: '/reports/profit-insights',
    label: 'Profit insights',
    description: 'Why profit changed · what looks unusual',
  },
  {
    to: '/purchases',
    label: 'Purchases',
    description: 'Supplier bills and stock receipts',
  },
  {
    to: '/suppliers',
    label: 'Suppliers',
    description: 'Vendor master',
  },
  {
    to: '/expenses',
    label: 'Expenses',
    description: 'Business money out',
  },
  {
    to: '/expenses/scan',
    label: 'Receipt photo',
    description: 'Upload a receipt → review → expense',
  },
  {
    to: '/day-book',
    label: 'Day Book',
    description: 'Daily money in and out',
  },
  {
    to: '/day-book/scan',
    label: 'Enter daily book',
    description: 'Paste lines → review → post',
  },
  {
    to: '/cash-bank',
    label: 'Cash & Bank',
    description: 'Cash in hand and bank balance',
  },
  {
    to: '/accounting',
    label: 'Books',
    description: 'Balanced journals and trial balance',
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
    to: '/purchases/recommend',
    label: 'What to buy',
    description: 'Suggested purchases from stock and sales',
  },
  {
    to: '/reports/stock',
    label: 'Valuation',
    description: 'Stock value at WAC',
  },
  {
    to: '/purchases',
    label: 'Purchases',
    description: 'Receive supplier stock',
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
    to: '/salesmen/claims',
    label: 'Claims',
    description: 'Pending expenses and returns',
  },
  {
    to: '/salesmen/payroll',
    label: 'Payroll',
    description: 'Monthly salary and commission',
  },
  {
    to: '/pricing/commission',
    label: 'Commission terms',
    description: 'Per-SKU commission rates',
  },
  {
    to: '/settings',
    label: 'Holidays',
    description: 'Company holidays for salary days',
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
