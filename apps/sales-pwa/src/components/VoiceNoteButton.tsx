import { useRef, useState } from 'react';
import { Button } from '@groaurum/ui';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import { useToast } from '@/components/Toast';
import { useT } from '@/i18n/language';
import { errorMessage } from '@/lib/errors';

type Props = {
  shopId: string;
  visitId?: string | null;
};

export function VoiceNoteButton({ shopId, visitId }: Props) {
  const api = useSalesmanApi();
  const toast = useToast();
  const t = useT();
  const recorder = useRef<MediaRecorder | null>(null);
  const started = useRef(0);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError(t('voice.unsupported'));
      return;
    }
    setError(null);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
    const media = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    media.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    media.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const seconds = Math.max(1, Math.min(120, Math.round((Date.now() - started.current) / 1000)));
      const blob = new Blob(chunks, { type: mime });
      void blob.arrayBuffer().then(async (bytes) => {
        try {
          await api.uploadVoiceNote({
            shopId,
            visitId,
            durationSeconds: seconds,
            bytes,
            contentType: mime,
          });
          toast.success(t('voice.saved'));
        } catch (err) {
          setError(errorMessage(err, 'Could not save the voice note.'));
        }
      });
    };
    recorder.current = media;
    started.current = Date.now();
    media.start();
    setRecording(true);
  }

  function stop() {
    recorder.current?.stop();
    setRecording(false);
  }

  return (
    <div className="ga-sales-stack">
      <Button
        type="button"
        variant="secondary"
        className="ga-sales-btn-block"
        onClick={() => void (recording ? stop() : start())}
      >
        {recording ? t('voice.stop') : t('voice.add')}
      </Button>
      {error ? (
        <p className="ga-sales-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
