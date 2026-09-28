import { describe, expect, it } from 'vitest';
import { NAV_TABS, navTabForPath } from './nav';

describe('bottom navigation tabs', () => {
  it('has exactly Home, Orders, Customers, Profile', () => {
    expect(NAV_TABS.map((t) => [t.label, t.to])).toEqual([
      ['Home', '/'],
      ['Orders', '/orders'],
      ['Customers', '/customers'],
      ['Profile', '/profile'],
    ]);
  });

  it.each([
    ['/', 'home'],
    ['/visits', 'home'],
    ['/orders', 'orders'],
    ['/orders/new', 'orders'],
    ['/customers', 'customers'],
    ['/customers/new', 'customers'],
    ['/customers/shop-1', 'customers'],
    ['/profile', 'profile'],
    ['/profile/earnings', 'profile'],
    ['/performance', 'profile'],
  ] as const)('%s highlights %s', (path, tab) => {
    expect(navTabForPath(path)).toBe(tab);
  });

  it('does not treat look-alike paths as a tab', () => {
    expect(navTabForPath('/ordersx')).toBe('home');
    expect(navTabForPath('/customersx')).toBe('home');
  });
});
