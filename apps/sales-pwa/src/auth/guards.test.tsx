import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { isButtonDisabled } from '@/test-utils/markup';

const mocks = vi.hoisted(() => ({
  session: {} as Record<string, unknown>,
}));

vi.mock('@groaurum/auth/react', () => ({
  useAuthSession: () => mocks.session,
  ProtectedRoute: ({ children }: { children: unknown }) => children,
  RoleGuard: ({ children }: { children: unknown }) => children,
}));

import { AuthError, ForbiddenSalesRole, WrongAudience } from './guards';

const SIGN_OUT = 'Sign out and go to login';

function render(element: ReactElement): string {
  return renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
}

beforeEach(() => {
  mocks.session = {
    session: { audience: 'delivery_pwa' },
    error: null,
    signOut: () => Promise.resolve(),
  };
});

describe('auth dead-end screens offer a way out (J)', () => {
  it('WrongAudience offers sign-out to login', () => {
    const html = render(<WrongAudience />);
    expect(html).toContain('Wrong application');
    expect(html).toContain('delivery pwa');
    expect(isButtonDisabled(html, SIGN_OUT)).toBe(false);
  });

  it('AuthError offers sign-out to login and a retry', () => {
    mocks.session.error = { code: 'session_expired', message: 'Your session expired.' };
    const html = render(<AuthError />);
    expect(html).toContain('Session expired');
    expect(html).toContain('Your session expired.');
    expect(isButtonDisabled(html, SIGN_OUT)).toBe(false);
    expect(isButtonDisabled(html, 'Try again')).toBe(false);
  });

  it('ForbiddenSalesRole offers sign-out to login', () => {
    const html = render(<ForbiddenSalesRole />);
    expect(html).toContain('This app requires a salesman role.');
    expect(isButtonDisabled(html, SIGN_OUT)).toBe(false);
  });
});
