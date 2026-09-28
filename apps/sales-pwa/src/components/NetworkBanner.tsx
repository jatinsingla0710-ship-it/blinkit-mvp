import { useEffect, useRef } from 'react';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { useToast } from './Toast';

export function NetworkBanner() {
  const online = useOnlineStatus();
  const toast = useToast();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
    } else if (wasOffline.current) {
      wasOffline.current = false;
      toast.success('Back online — refreshing your data.');
    }
  }, [online, toast]);

  if (online) return null;
  return (
    <div className="ga-sales-network-banner" role="status">
      You&apos;re offline. Showing the last loaded data — saving orders, visits and
      attendance needs signal.
    </div>
  );
}
