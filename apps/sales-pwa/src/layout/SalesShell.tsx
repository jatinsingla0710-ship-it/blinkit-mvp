import { NavLink, Outlet } from 'react-router-dom';
import { useAuthSession, useCurrentUser } from '@groaurum/auth/react';
import { Button } from '@groaurum/ui';
import { isSalesDataMockMode } from '@/data/salesmanApi';
import './SalesShell.css';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/customers', label: 'Customers', end: false },
  { to: '/visits', label: 'Visits', end: false },
  { to: '/performance', label: 'Performance', end: false },
] as const;

export function SalesShell() {
  const user = useCurrentUser();
  const { signOut } = useAuthSession();
  const mockMode = isSalesDataMockMode();

  return (
    <div className={`ga-sales-shell${mockMode ? ' ga-sales-shell--mock' : ''}`}>
      {mockMode ? (
        <div className="ga-sales-mock-banner" role="status">
          Demo / mock mode — create, invite, and orders are in-memory only and
          are not saved to Supabase. Set <code>VITE_DATA_ADAPTER=supabase</code>{' '}
          for real field operations.
        </div>
      ) : null}
      <header className="ga-sales-topbar">
        <div className="ga-sales-topbar__brand">
          <span className="ga-sales-topbar__logo">
            GroAurum Sales{mockMode ? ' · Demo' : ''}
          </span>
          <span className="ga-sales-topbar__user">
            {user?.displayName ?? (mockMode ? 'Demo salesman' : 'Salesman')}
          </span>
        </div>
        <Button
          variant="ghost"
          type="button"
          onClick={() => {
            void signOut();
          }}
        >
          Log out
        </Button>
      </header>

      <main className="ga-sales-main">
        <Outlet />
      </main>

      <nav className="ga-sales-bottom-nav" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              [
                'ga-sales-bottom-nav__link',
                isActive ? 'ga-sales-bottom-nav__link--active' : '',
              ]
                .filter(Boolean)
                .join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
