import { Suspense, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { usePermissions } from '@groaurum/auth/react';
import { SIDEBAR_NAV_GROUPS } from '@/data/nav';
import { PATH_MODULE } from '@/auth/moduleRoutes';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import './AdminShell.css';

export function AdminShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { canAccessModule } = usePermissions();

  const groups = useMemo(
    () =>
      SIDEBAR_NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const module = PATH_MODULE[item.path];
          if (!module) return true;
          return canAccessModule(module);
        }),
      })).filter((group) => group.items.length > 0),
    [canAccessModule],
  );

  return (
    <div className="ga-shell">
      <a className="ga-skip-link" href="#ga-main">
        Skip to main content
      </a>
      <TopNav
        groups={groups}
        onMenuClick={() => setSidebarOpen((v) => !v)}
      />
      <div className="ga-shell__body">
        <Sidebar
          groups={groups}
          open={sidebarOpen}
          onNavigate={() => setSidebarOpen(false)}
        />
        {sidebarOpen ? (
          <button
            type="button"
            className="ga-shell__backdrop"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}
        <main id="ga-main" className="ga-shell__main" tabIndex={-1}>
          <Suspense fallback={<PageSkeleton title="Loading page" blocks={2} />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
