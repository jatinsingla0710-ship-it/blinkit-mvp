import type { NavGroup, NavItem } from '@/data/dashboard-types';

/**
 * Phase 1 Admin information architecture.
 * Secondary features keep existing routes but leave the top-level sidebar.
 */
export const SIDEBAR_NAV_GROUPS: NavGroup[] = [
  {
    id: 'home',
    label: null,
    items: [{ id: 'dashboard', label: 'Dashboard', path: '/' }],
  },
  {
    id: 'business',
    label: 'Business',
    items: [
      { id: 'customers', label: 'Customers', path: '/customers' },
      {
        id: 'sales',
        label: 'Sales',
        path: '/orders',
        matchPrefixes: ['/orders', '/sales', '/payments'],
      },
      {
        id: 'products',
        label: 'Products',
        path: '/products',
        matchPrefixes: ['/products', '/categories', '/pricing'],
        excludePrefixes: ['/pricing/commission'],
      },
      {
        id: 'inventory',
        label: 'Inventory',
        path: '/inventory',
        matchPrefixes: ['/inventory'],
      },
      {
        id: 'delivery',
        label: 'Delivery',
        path: '/delivery',
        matchPrefixes: ['/delivery'],
      },
    ],
  },
  {
    id: 'team',
    label: 'Team',
    items: [
      {
        id: 'salesmen',
        label: 'Salesmen',
        path: '/salesmen',
        matchPrefixes: ['/salesmen', '/pricing/commission'],
      },
    ],
  },
  {
    id: 'accounting',
    label: 'Accounting',
    items: [
      {
        id: 'receivables',
        label: 'Receivables',
        path: '/receivables',
        matchPrefixes: ['/receivables'],
      },
      {
        id: 'purchases',
        label: 'Purchases',
        path: '/purchases',
        matchPrefixes: ['/purchases', '/suppliers'],
      },
      {
        id: 'expenses',
        label: 'Expenses',
        path: '/expenses',
        matchPrefixes: ['/expenses'],
      },
      {
        id: 'day-book',
        label: 'Day Book',
        path: '/day-book',
        matchPrefixes: ['/day-book'],
      },
    ],
  },
  {
    id: 'system',
    label: null,
    items: [
      { id: 'reports', label: 'Reports', path: '/reports', matchPrefixes: ['/reports'] },
      {
        id: 'settings',
        label: 'Settings',
        path: '/settings',
        matchPrefixes: ['/settings', '/service-areas', '/warehouses'],
      },
    ],
  },
];

/** Flat list for permission filtering and legacy imports. */
export const SIDEBAR_NAV: NavItem[] = SIDEBAR_NAV_GROUPS.flatMap(
  (group) => group.items,
);

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix === '/') return pathname === '/' || pathname === '';
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Whether a sidebar item should appear active for the current location. */
export function isSidebarItemActive(
  pathname: string,
  item: NavItem,
): boolean {
  const path = pathname || '/';

  for (const excluded of item.excludePrefixes ?? []) {
    if (pathMatchesPrefix(path, excluded)) return false;
  }

  const prefixes = item.matchPrefixes?.length
    ? item.matchPrefixes
    : [item.path];

  return prefixes.some((prefix) => pathMatchesPrefix(path, prefix));
}
