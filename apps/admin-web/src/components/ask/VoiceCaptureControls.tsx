import { Button } from '@groaurum/ui';
import { VOICE_CAPTURE_HONESTY } from '@/data/voice-capture';
import type { UseVoiceCaptureResult } from '@/data/useVoiceCapture';
import './VoiceCaptureControls.css';

type Props = {
  voice: UseVoiceCaptureResult;
  disabled?: boolean;
  onConfirm: (transcript: string) => void;
};

/**
 * Phase 22 — speak → preview → confirm.
 * Confirm is required before Ask/books tools run.
 */
export function VoiceCaptureControls({
  voice,
  disabled = false,
  onConfirm,
}: Props) {
  if (!voice.supported) {
    return (
      <p className="ga-voice__note" role="status">
        {voice.unsupportedReason ?? 'Voice not available in this browser.'}
      </p>
    );
  }

  const listening = voice.phase === 'listening';
  const preview =
    voice.phase === 'preview' ||
    (voice.transcript.trim().length > 0 && !listening);

  return (
    <div className="ga-voice">
      <div className="ga-voice__actions">
        {listening ? (
          <Button
            type="button"
            variant="secondary"
            onClick={voice.stopListening}
            disabled={disabled}
          >
            Stop
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            onClick={voice.startListening}
            disabled={disabled}
          >
            Speak
          </Button>
        )}
        {preview ? (
          <>
            <Button
              type="button"
              onClick={() => onConfirm(voice.transcript.trim())}
              disabled={disabled || !voice.transcript.trim()}
            >
              Use this question
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={voice.reset}
              disabled={disabled}
            >
              Clear voice
            </Button>
          </>
        ) : null}
      </div>
      <p className="ga-voice__status" aria-live="polite">
        {voice.statusLabel}
        {voice.interimTranscript
          ? ` · hearing “${voice.interimTranscript}”`
          : ''}
      </p>
      {voice.transcript.trim() ? (
        <label className="ga-voice__preview">
          <span>Heard (edit before asking)</span>
          <textarea
            value={voice.transcript}
            onChange={(e) => voice.setTranscript(e.target.value)}
            rows={2}
            disabled={disabled || listening}
          />
        </label>
      ) : null}
      {voice.errorMessage ? (
        <p className="ga-voice__error" role="alert">
          {voice.errorMessage}
        </p>
      ) : null}
      <p className="ga-voice__honesty">{VOICE_CAPTURE_HONESTY}</p>
    </div>
  );
}
