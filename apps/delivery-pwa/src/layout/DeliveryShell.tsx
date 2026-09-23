import { NavLink, Outlet } from 'react-router-dom';
import { useAuthSession, useCurrentUser } from '@groaurum/auth/react';
import { Button } from '@groaurum/ui';
import './DeliveryShell.css';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/routes', label: 'Routes', end: false },
  { to: '/cod', label: 'COD', end: false },
] as const;

export function DeliveryShell() {
  const user = useCurrentUser();
  const { signOut } = useAuthSession();

  return (
    <div className="ga-delivery-shell">
      <header className="ga-delivery-topbar">
        <div className="ga-delivery-topbar__brand">
          <span className="ga-delivery-topbar__logo">GroAurum Delivery</span>
          <span className="ga-delivery-topbar__user">
            {user?.displayName ?? 'Delivery'}
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

      <main className="ga-delivery-main">
        <Outlet />
      </main>

      <nav className="ga-delivery-bottom-nav" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              [
                'ga-delivery-bottom-nav__link',
                isActive ? 'ga-delivery-bottom-nav__link--active' : '',
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
