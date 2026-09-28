export type NavTab = 'home' | 'orders' | 'customers' | 'profile';

export const NAV_TABS: readonly { tab: NavTab; to: string; label: string }[] = [
  { tab: 'home', to: '/', label: 'Home' },
  { tab: 'orders', to: '/orders', label: 'Orders' },
  { tab: 'customers', to: '/customers', label: 'Customers' },
  { tab: 'profile', to: '/profile', label: 'Profile' },
];

function within(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Inner screens keep their parent tab highlighted (Visits → Home, Earnings → Profile). */
export function navTabForPath(pathname: string): NavTab {
  if (within(pathname, '/orders')) return 'orders';
  if (within(pathname, '/customers')) return 'customers';
  if (within(pathname, '/profile') || within(pathname, '/performance')) {
    return 'profile';
  }
  return 'home';
}
