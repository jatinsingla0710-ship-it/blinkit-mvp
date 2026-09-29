import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, TextField } from '@groaurum/ui';
import { requireLiveAdminApi } from '@/data/adminDataClient';
import { formatMutationError } from '@/data/mutation-errors';
import { useSendSalesmanMessageMutation } from '@/data/mutations';

type Props = {
  profileId: string;
  canManage: boolean;
};

export function SalesmanMessagesPanel({ profileId, canManage }: Props) {
  const queryClient = useQueryClient();
  const send = useSendSalesmanMessageMutation();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messages = useQuery({
    queryKey: ['groaurum', 'salesmen', 'messages', profileId],
    queryFn: () => requireLiveAdminApi().listSalesmanMessages(profileId),
    enabled: Boolean(profileId),
  });
  const notes = useQuery({
    queryKey: ['groaurum', 'salesmen', 'voice', profileId],
    queryFn: () => requireLiveAdminApi().listSalesmanVoiceNotes(profileId),
    enabled: Boolean(profileId),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text) {
      setError('Enter a message.');
      return;
    }
    setError(null);
    send.mutate(
      { profileId, body: text },
      {
        onSuccess: async () => {
          setBody('');
          await queryClient.invalidateQueries({
            queryKey: ['groaurum', 'salesmen', 'messages', profileId],
          });
        },
        onError: (err) => setError(formatMutationError(err, 'Could not send the message')),
      },
    );
  }

  return (
    <div className="ga-sm-claims">
      <section aria-label="Messages">
        <h3>Messages</h3>
        <p className="ga-sm-claims__hint">Text only. This does not change orders or payments.</p>
        {messages.isPending ? <p className="ga-sm-claims__hint">Loading messages…</p> : null}
        {messages.isError ? (
          <p className="ga-sm-claims__error" role="alert">
            {formatMutationError(messages.error, 'Could not load messages')}
          </p>
        ) : null}
        {messages.data && messages.data.length === 0 ? (
          <p className="ga-sm-claims__hint">No messages.</p>
        ) : null}
        {messages.data?.map((message) => (
          <article key={message.id} className="ga-sm-claims__card">
            <p>{message.body}</p>
            <p className="ga-sm-claims__hint">
              {message.senderProfileId === profileId ? 'Salesman' : 'Office'}
            </p>
          </article>
        ))}
        {canManage ? (
          <form className="ga-sm-claims__card" onSubmit={onSubmit}>
            <TextField label="Message" value={body} onChange={(event) => setBody(event.target.value)} />
            {error ? (
              <p className="ga-sm-claims__error" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" variant="primary" disabled={send.isPending}>
              Send
            </Button>
          </form>
        ) : null}
      </section>
      <section aria-label="Voice notes">
        <h3>Voice notes</h3>
        {notes.isPending ? <p className="ga-sm-claims__hint">Loading voice notes…</p> : null}
        {notes.isError ? (
          <p className="ga-sm-claims__error" role="alert">
            {formatMutationError(notes.error, 'Could not load voice notes')}
          </p>
        ) : null}
        {notes.data && notes.data.length === 0 ? <p className="ga-sm-claims__hint">No voice notes.</p> : null}
        {notes.data?.map((note) => (
          <article key={note.id} className="ga-sm-claims__card">
            <p>{note.durationSeconds} seconds</p>
            {note.audioUrl ? <audio controls src={note.audioUrl} /> : <p>Audio is not ready.</p>}
          </article>
        ))}
      </section>
    </div>
  );
}
