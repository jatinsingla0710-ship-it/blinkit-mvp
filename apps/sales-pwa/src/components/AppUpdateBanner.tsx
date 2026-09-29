import { useEffect, useState } from 'react';
import { listenForAppUpdate, refreshSalesApp } from '@/lib/app-update';

export function AppUpdateBanner() {
  const [ready, setReady] = useState(false);

  useEffect(() => listenForAppUpdate(() => setReady(true)), []);

  if (!ready) return null;

  return (
    <div className="ga-sales-update" role="status">
      <p>A new version of Salesaurum is ready.</p>
      <button type="button" onClick={() => refreshSalesApp()}>
        Refresh
      </button>
    </div>
  );
}
