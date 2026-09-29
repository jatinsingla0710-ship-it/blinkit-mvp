import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@groaurum/auth/react';
import { Button, TextField } from '@groaurum/ui';
import { ErrorState } from '@/components/ErrorState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { LoadingState } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import { enqueueOfflineJob } from '@/data/offline-queue';
import { useT } from '@/i18n/language';
import { errorMessage } from '@/lib/errors';

export function MessagesPage() {
  const user = useCurrentUser();
  const api = useSalesmanApi();
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();
  const profileId = user?.id ?? '';
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ['sales', 'messages', profileId],
    queryFn: () => api.listMessages(),
    enabled: Boolean(profileId),
  });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text) {
      setError('Enter a message.');
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      enqueueOfflineJob({ id: crypto.randomUUID(), kind: 'message', body: text });
      setBody('');
      toast.success('Message will send when you are back online.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.sendMessage(text);
      setBody('');
      await queryClient.invalidateQueries({ queryKey: ['sales', 'messages', profileId] });
    } catch (err) {
      setError(errorMessage(err, 'Could not send the message.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ga-sales-stack">
      <ScreenHeader title={t('messages.title')} backTo="/profile" backLabel="Profile" />
      {query.isLoading ? <LoadingState label="Loading messages…" rows={3} /> : null}
      {query.isError ? (
        <ErrorState
          message={errorMessage(query.error, 'Could not load messages.')}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.data && query.data.length === 0 ? <p className="ga-sales-muted">{t('messages.empty')}</p> : null}
      {query.data && query.data.length > 0 ? (
        <div className="ga-sales-list">
          {query.data.map((message) => (
            <article key={message.id} className="ga-sales-list-item">
              <p>{message.body}</p>
              <p className="ga-sales-muted">
                {message.senderProfileId === profileId ? 'You' : 'Office'}
              </p>
            </article>
          ))}
        </div>
      ) : null}
      <form className="ga-sales-stack ga-sales-claim-form" onSubmit={(event) => void onSubmit(event)}>
        <TextField label={t('messages.placeholder')} value={body} onChange={(event) => setBody(event.target.value)} />
        {error ? (
          <p className="ga-sales-error" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" className="ga-sales-btn-block" disabled={busy}>
          {busy ? '…' : t('messages.send')}
        </Button>
      </form>
    </div>
  );
}
