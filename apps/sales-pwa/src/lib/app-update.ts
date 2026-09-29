/**
 * A new service worker may take control after a deploy. The page must not
 * reload by itself — an in-progress order would be lost. The salesman refreshes.
 */
export function shouldPromptForAppRefresh(hadController: boolean): boolean {
  return hadController;
}

/** Refresh is always the salesman's tap. A waiting worker is activated first. */
export function appRefreshPlan(hasWaitingWorker: boolean): 'activate-then-reload' | 'reload' {
  return hasWaitingWorker ? 'activate-then-reload' : 'reload';
}

export function refreshSalesApp(): void {
  const reload = () => window.location.reload();
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    reload();
    return;
  }
  void navigator.serviceWorker.getRegistration().then((registration) => {
    const waiting = registration?.waiting ?? null;
    if (appRefreshPlan(Boolean(waiting)) === 'reload' || !waiting) {
      reload();
      return;
    }
    const onChange = () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onChange);
      reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onChange);
    waiting.postMessage({ type: 'SKIP_WAITING' });
  });
}

export function listenForAppUpdate(onUpdate: () => void): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return () => undefined;
  }
  const hadController = Boolean(navigator.serviceWorker.controller);
  const onChange = () => {
    if (shouldPromptForAppRefresh(hadController)) onUpdate();
  };
  navigator.serviceWorker.addEventListener('controllerchange', onChange);

  const check = () => {
    if (document.visibilityState !== 'visible') return;
    void navigator.serviceWorker.getRegistration().then((registration) => {
      void registration?.update();
    });
  };
  document.addEventListener('visibilitychange', check);

  return () => {
    navigator.serviceWorker.removeEventListener('controllerchange', onChange);
    document.removeEventListener('visibilitychange', check);
  };
}
