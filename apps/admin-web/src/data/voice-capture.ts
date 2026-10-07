/**
 * Phase 22 — Voice capture helpers.
 * Browser Web Speech API only (no cloud STT keys).
 * Transcript must be owner-confirmed before Ask/books tools run.
 */

export type VoiceCapturePhase =
  | 'unsupported'
  | 'idle'
  | 'listening'
  | 'preview'
  | 'error';

export type VoiceCaptureSupport =
  | { supported: true }
  | { supported: false; reason: string };

/** Minimal SpeechRecognition surface used by Admin (browser may extend Window). */
export type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

export type SpeechRecognitionResultEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function getSpeechRecognitionCtor(
  win: unknown,
): SpeechRecognitionCtor | null {
  if (!win || typeof win !== 'object') return null;
  const w = win as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function detectVoiceCaptureSupport(win: unknown): VoiceCaptureSupport {
  if (typeof win === 'undefined' || win == null) {
    return {
      supported: false,
      reason: 'Voice capture needs a browser window.',
    };
  }
  if (!getSpeechRecognitionCtor(win)) {
    return {
      supported: false,
      reason:
        'This browser does not support speech recognition. Type your question instead.',
    };
  }
  return { supported: true };
}

export function normalizeVoiceTranscript(raw: string): string {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Merge final SpeechRecognition results into one transcript string. */
export function transcriptFromRecognitionResults(
  results: SpeechRecognitionResultEventLike['results'],
  fromIndex = 0,
): { finalText: string; interimText: string } {
  let finalText = '';
  let interimText = '';
  for (let i = fromIndex; i < results.length; i += 1) {
    const row = results[i];
    if (!row) continue;
    const piece = normalizeVoiceTranscript(row[0]?.transcript ?? '');
    if (!piece) continue;
    if (row.isFinal) {
      finalText = normalizeVoiceTranscript(`${finalText} ${piece}`);
    } else {
      interimText = normalizeVoiceTranscript(`${interimText} ${piece}`);
    }
  }
  return { finalText, interimText };
}

export function voiceCaptureStatusLabel(phase: VoiceCapturePhase): string {
  switch (phase) {
    case 'unsupported':
      return 'Voice not available';
    case 'listening':
      return 'Listening…';
    case 'preview':
      return 'Check what was heard';
    case 'error':
      return 'Voice error';
    case 'idle':
    default:
      return 'Tap to speak';
  }
}

export const VOICE_CAPTURE_HONESTY =
  'Speech is transcribed in your browser, then you confirm before Ask runs. Nothing is posted to the books from voice alone.';
