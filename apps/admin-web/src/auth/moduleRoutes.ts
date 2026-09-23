import type { AdminModule } from '@groaurum/auth';

/** Maps admin paths to RBAC modules. */
export function moduleForPath(pathname: string): AdminModule | null {
  if (pathname === '/' || pathname === '') return 'dashboard';
  if (pathname.startsWith('/orders')) return 'orders';
  if (pathname.startsWith('/sales')) return 'orders';
  if (pathname.startsWith('/customers')) return 'customers';
  if (pathname.startsWith('/products')) return 'products';
  if (pathname.startsWith('/categories')) return 'categories';
  if (pathname.startsWith('/pricing')) return 'pricing';
  if (pathname.startsWith('/inventory')) return 'inventory';
  if (pathname.startsWith('/salesmen')) return 'salesmen';
  if (pathname.startsWith('/delivery')) return 'delivery';
  if (pathname.startsWith('/payments')) return 'payments';
  if (pathname.startsWith('/service-areas')) return 'service_areas';
  if (pathname.startsWith('/warehouses')) return 'warehouses';
  if (pathname.startsWith('/reports')) return 'reports';
  if (pathname.startsWith('/settings')) return 'settings';
  return null;
}

export const PATH_MODULE: Record<string, AdminModule> = {
  '/': 'dashboard',
  '/orders': 'orders',
  '/sales': 'orders',
  '/customers': 'customers',
  '/products': 'products',
  '/categories': 'categories',
  '/pricing': 'pricing',
  '/pricing/commission': 'pricing',
  '/inventory': 'inventory',
  '/salesmen': 'salesmen',
  '/delivery': 'delivery',
  '/payments': 'payments',
  '/service-areas': 'service_areas',
  '/warehouses': 'warehouses',
  '/reports': 'reports',
  '/settings': 'settings',
};
