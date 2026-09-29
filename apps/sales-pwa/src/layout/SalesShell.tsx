import { useEffect, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useCurrentUser } from '@groaurum/auth/react';
import { isSalesDataMockMode } from '@/data/salesmanApi';
import { NetworkBanner } from '@/components/NetworkBanner';
import { ToastProvider } from '@/components/Toast';
import {
  CustomersIcon,
  HomeIcon,
  OrdersIcon,
  ProfileIcon,
} from '@/components/icons';
import { useT } from '@/i18n/language';
import { NAV_TABS, navTabForPath, type NavTab } from './nav';
import './SalesShell.css';

const TAB_ICONS: Record<NavTab, ReactNode> = {
  home: <HomeIcon />,
  orders: <OrdersIcon />,
  customers: <CustomersIcon />,
  profile: <ProfileIcon />,
};

export function SalesShell() {
  const user = useCurrentUser();
  const mockMode = isSalesDataMockMode();
  const { pathname } = useLocation();
  const activeTab = navTabForPath(pathname);
  const t = useT();
  const tabLabel: Record<NavTab, string> = {
    home: t('nav.home'),
    orders: t('nav.orders'),
    customers: t('nav.customers'),
    profile: t('nav.profile'),
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <ToastProvider>
      <div className={`ga-sales-shell${mockMode ? ' ga-sales-shell--mock' : ''}`}>
        {mockMode ? (
          <div className="ga-sales-mock-banner" role="status">
            Demo / mock mode — customers and orders are in-memory only and
            are not saved to Supabase. Set <code>VITE_DATA_ADAPTER=supabase</code>{' '}
            for real field operations.
          </div>
        ) : null}
        <div className="ga-sales-sticky-top">
          <header className="ga-sales-topbar">
            <div className="ga-sales-topbar__brand">
              <img className="ga-sales-topbar__mark" src="/icons/icon-192.png" alt="" />
              <span className="ga-sales-topbar__text">
                <span className="ga-sales-topbar__logo">
                  Salesaurum{mockMode ? ' · Demo' : ''}
                </span>
                <span className="ga-sales-topbar__user">
                  {user?.displayName ?? (mockMode ? 'Demo salesman' : 'Salesman')}
                </span>
              </span>
            </div>
          </header>
          <NetworkBanner />
        </div>

        <main className="ga-sales-main">
          <Outlet />
        </main>

        <nav className="ga-sales-bottom-nav" aria-label="Primary">
          {NAV_TABS.map((item) => {
            const active = item.tab === activeTab;
            return (
              <Link
                key={item.tab}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`ga-sales-bottom-nav__link${
                  active ? ' ga-sales-bottom-nav__link--active' : ''
                }`}
              >
                {TAB_ICONS[item.tab]}
                <span>{tabLabel[item.tab]}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </ToastProvider>
  );
}
