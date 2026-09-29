import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@groaurum/auth/react';
import { Button } from '@groaurum/ui';
import { ErrorState } from '@/components/ErrorState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { LoadingState } from '@/components/Skeleton';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import { useT } from '@/i18n/language';
import { errorMessage } from '@/lib/errors';

function urlBase64ToBytes(value: string): BufferSource {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function pushKey(): string | null {
  const key = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY;
  return typeof key === 'string' && key.length > 0 ? key : null;
}

export function NoticesPage() {
  const user = useCurrentUser();
  const api = useSalesmanApi();
  const t = useT();
  const queryClient = useQueryClient();
  const profileId = user?.id ?? '';
  const [pushNote, setPushNote] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['sales', 'notices', profileId],
    queryFn: () => api.listNotices(),
    enabled: Boolean(profileId),
  });

  async function enablePush() {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushNote(t('notices.unavailable'));
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setPushNote(t('notices.unavailable'));
      return;
    }
    const key = pushKey();
    if (!key) {
      setPushNote(t('notices.unavailable'));
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBytes(key),
    });
    const json = subscription.toJSON();
    await api.savePushSubscription({
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      authKey: json.keys?.auth ?? '',
    });
    setPushNote(t('notices.enabled'));
  }

  return (
    <div className="ga-sales-stack">
      <ScreenHeader title={t('notices.title')} backTo="/profile" backLabel="Profile" />
      <Button type="button" variant="primary" className="ga-sales-btn-block" onClick={() => void enablePush()}>
        {t('notices.enable')}
      </Button>
      {pushNote ? <p className="ga-sales-muted">{pushNote}</p> : null}
      {query.isLoading ? <LoadingState label="Loading alerts…" rows={3} /> : null}
      {query.isError ? (
        <ErrorState
          message={errorMessage(query.error, 'Could not load alerts.')}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.data && query.data.length === 0 ? <p className="ga-sales-muted">{t('notices.empty')}</p> : null}
      {query.data?.map((notice) => (
        <article key={notice.id} className="ga-sales-list-item">
          <strong>{notice.title}</strong>
          <p>{notice.body}</p>
          {notice.href ? <Link to={notice.href}>Open</Link> : null}
          {notice.readAt ? null : (
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                void api.markNoticeRead(notice.id).then(() =>
                  queryClient.invalidateQueries({ queryKey: ['sales', 'notices', profileId] }),
                )
              }
            >
              Mark read
            </Button>
          )}
        </article>
      ))}
    </div>
  );
}
