import { Suspense, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { usePermissions } from '@groaurum/auth/react';
import { SIDEBAR_NAV } from '@/data/nav';
import { PATH_MODULE } from '@/auth/moduleRoutes';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import './AdminShell.css';

export function AdminShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { canAccessModule } = usePermissions();

  const items = useMemo(
    () =>
      SIDEBAR_NAV.filter((item) => {
        const module = PATH_MODULE[item.path];
        if (!module) return true;
        return canAccessModule(module);
      }),
    [canAccessModule],
  );

  return (
    <div className="ga-shell">
      <TopNav onMenuClick={() => setSidebarOpen((v) => !v)} />
      <div className="ga-shell__body">
        <Sidebar
          items={items}
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
        <main className="ga-shell__main">
          <Suspense fallback={<PageSkeleton title="Loading page" blocks={2} />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
