import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { isButtonDisabled, linkHref } from '@/test-utils/markup';

vi.mock('@groaurum/auth/react', () => ({
  useCurrentUser: () => ({
    id: 'profile-1',
    displayName: 'Asha Verma',
    email: 'asha@groaurum.in',
    phone: null,
  }),
  useAuthSession: () => ({ signOut: () => Promise.resolve() }),
}));

vi.mock('@/data/salesmanApi', () => ({
  isSalesDataMockMode: () => false,
}));

import { ToastProvider } from '@/components/Toast';
import { ProfilePage } from './ProfilePage';

function render(): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/profile']}>
      <ToastProvider>
        <ProfilePage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('ProfilePage', () => {
  it('shows the signed-in salesman', () => {
    const html = render();
    expect(html).toContain('Asha Verma');
    expect(html).toContain('asha@groaurum.in');
  });

  it('links to My Earnings', () => {
    const html = render();
    expect(html).toContain('My Earnings');
    expect(/href="\/profile\/earnings"/.test(html)).toBe(true);
  });

  it('offers an enabled Sign out button', () => {
    expect(isButtonDisabled(render(), 'Sign out')).toBe(false);
  });

  it('is a tab root, so it has no back link', () => {
    expect(linkHref(render(), 'Back to Home')).toBeNull();
  });
});
