import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { isButtonDisabled } from '@/test-utils/markup';

const mocks = vi.hoisted(() => ({
  profile: {
    data: {
      id: 'profile-1',
      displayName: 'Asha Verma',
      email: 'asha@example.com',
      preferredLanguage: 'en' as const,
      avatarPath: null,
      avatarUrl: null as string | null,
      setupCompletedAt: '2026-01-01T00:00:00.000Z',
    },
    isLoading: false,
    isError: false,
    isFetching: false,
    error: null as Error | null,
    refetch: () => Promise.resolve(),
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => mocks.profile,
  useQueryClient: () => ({ invalidateQueries: () => Promise.resolve() }),
}));

vi.mock('@groaurum/auth/react', () => ({
  useCurrentUser: () => ({
    id: 'profile-1',
    displayName: 'Asha Verma',
    email: 'asha@example.com',
    phone: null,
  }),
  useAuthSession: () => ({
    signOut: () => Promise.resolve(),
    refreshSession: () => Promise.resolve(null),
  }),
}));

vi.mock('@/data/SalesDataProviders', () => ({
  useSalesmanApi: () => ({
    updateOwnProfile: () => Promise.resolve(mocks.profile.data),
    uploadProfilePhoto: () => Promise.resolve({ path: 'profile-1/profile' }),
  }),
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

beforeEach(() => {
  mocks.profile.isLoading = false;
  mocks.profile.isError = false;
  mocks.profile.error = null;
  mocks.profile.data.avatarUrl = null;
});

describe('ProfilePage', () => {
  it('shows name, email, language, version, and earnings', () => {
    const html = render();
    expect(html).toContain('Asha Verma');
    expect(html).toContain('asha@example.com');
    expect(html).toContain('Preferred language');
    expect(html).toContain('English');
    expect(html).toContain('App version');
    expect(html).toContain('My Earnings');
    expect(/href="\/profile\/earnings"/.test(html)).toBe(true);
    expect(/href="\/profile\/expenses"/.test(html)).toBe(true);
    expect(/href="\/profile\/returns"/.test(html)).toBe(true);
    expect(html).not.toContain('GroAurum');
    expect(html).not.toContain('Employment');
  });

  it('offers an enabled Sign out button', () => {
    expect(isButtonDisabled(render(), 'Sign out')).toBe(false);
  });

  it('shows a photo and keeps the name when a photo error is visible', () => {
    mocks.profile.data.avatarUrl = 'https://example.test/photo';
    const html = render();
    expect(html).toContain('https://example.test/photo');
    expect(html).toContain('Asha Verma');
    expect(html).toContain('Replace photo');
  });

  it('shows Retry when the profile fails to load', () => {
    mocks.profile.isError = true;
    mocks.profile.error = new Error('profile offline');
    const html = render();
    expect(html).toContain('profile offline');
    expect(isButtonDisabled(html, 'Retry')).toBe(false);
  });
});
