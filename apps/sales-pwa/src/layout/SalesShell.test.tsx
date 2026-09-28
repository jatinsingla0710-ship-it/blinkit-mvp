import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { linkHref } from '@/test-utils/markup';

vi.mock('@groaurum/auth/react', () => ({
  useCurrentUser: () => ({ id: 'profile-1', displayName: 'Asha Verma' }),
}));

vi.mock('@/data/salesmanApi', () => ({
  isSalesDataMockMode: () => false,
}));

import { SalesShell } from './SalesShell';

function render(path: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <SalesShell />
    </MemoryRouter>,
  );
}

function currentTab(html: string): string | null {
  const match = /<a\b[^>]*aria-current="page"[^>]*>([\s\S]*?)<\/a>/.exec(html);
  return match ? match[1].replace(/<[^>]+>/g, '').trim() : null;
}

describe('SalesShell bottom navigation', () => {
  it('renders the four primary tabs with labels and routes', () => {
    const html = render('/');
    expect(html).toContain('aria-label="Primary"');
    expect(linkHref(html, 'Home')).toBe('/');
    expect(linkHref(html, 'Orders')).toBe('/orders');
    expect(linkHref(html, 'Customers')).toBe('/customers');
    expect(linkHref(html, 'Profile')).toBe('/profile');
    expect(linkHref(html, 'Visits')).toBeNull();
    expect(linkHref(html, 'Performance')).toBeNull();
  });

  it.each([
    ['/', 'Home'],
    ['/visits', 'Home'],
    ['/orders/new', 'Orders'],
    ['/customers/shop-1', 'Customers'],
    ['/profile/earnings', 'Profile'],
  ])('marks the active tab for %s', (path, label) => {
    expect(currentTab(render(path))).toBe(label);
  });

  it('keeps sign-out out of the top bar (it lives in Profile)', () => {
    const html = render('/');
    expect(html).not.toContain('Log out');
    expect(html).not.toContain('Sign out');
    expect(html).toContain('Asha Verma');
  });
});
