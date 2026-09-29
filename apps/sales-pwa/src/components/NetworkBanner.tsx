import { useEffect, useRef } from 'react';
import { useSyncExternalStore } from 'react';
import { useT } from '@/i18n/language';
import {
  getOfflineSyncSnapshot,
  subscribeOfflineSync,
} from '@/data/offline-queue';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { useToast } from './Toast';

export function NetworkBanner() {
  const online = useOnlineStatus();
  const toast = useToast();
  const t = useT();
  const sync = useSyncExternalStore(
    subscribeOfflineSync,
    getOfflineSyncSnapshot,
    getOfflineSyncSnapshot,
  );
  const announced = useRef('');

  useEffect(() => {
    if (sync.phase === 'sent' && announced.current !== 'sent') {
      announced.current = 'sent';
      toast.success(t('offline.sent'));
      return;
    }
    if (sync.phase === 'failed' && announced.current !== 'failed') {
      announced.current = 'failed';
      toast.error(t('offline.failed'));
      return;
    }
    if (sync.phase === 'idle' || sync.phase === 'syncing') {
      announced.current = '';
    }
  }, [sync.phase, t, toast]);

  if (!online) {
    return (
      <div className="ga-sales-network-banner" role="status">
        <p>{t('offline.banner')}</p>
        {sync.pending > 0 ? <p>{t('offline.waiting')}</p> : null}
      </div>
    );
  }

  if (sync.phase === 'syncing') {
    return (
      <div className="ga-sales-network-banner" role="status">
        {t('offline.syncing')}
      </div>
    );
  }

  if (sync.phase === 'failed' && sync.failed > 0) {
    return (
      <div className="ga-sales-network-banner ga-sales-network-banner--failed" role="alert">
        {t('offline.failed')}
      </div>
    );
  }

  return null;
}
