import { useCallback, useEffect, useRef, useState } from 'react';
import {
  detectVoiceCaptureSupport,
  getSpeechRecognitionCtor,
  normalizeVoiceTranscript,
  transcriptFromRecognitionResults,
  voiceCaptureStatusLabel,
  type SpeechRecognitionLike,
  type VoiceCapturePhase,
} from '@/data/voice-capture';

export type UseVoiceCaptureResult = {
  supported: boolean;
  unsupportedReason: string | null;
  phase: VoiceCapturePhase;
  statusLabel: string;
  /** Accumulated final transcript while listening / in preview. */
  transcript: string;
  interimTranscript: string;
  errorMessage: string | null;
  startListening: () => void;
  stopListening: () => void;
  reset: () => void;
  setTranscript: (value: string) => void;
};

/**
 * Browser speech recognition for Phase 22.
 * Does not call books tools — caller confirms transcript first.
 */
export function useVoiceCapture(opts?: {
  lang?: string;
}): UseVoiceCaptureResult {
  const lang = opts?.lang ?? 'en-IN';
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [supported, setSupported] = useState(false);
  const [unsupportedReason, setUnsupportedReason] = useState<string | null>(
    null,
  );
  const [phase, setPhase] = useState<VoiceCapturePhase>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const support = detectVoiceCaptureSupport(window);
    if (!support.supported) {
      setSupported(false);
      setUnsupportedReason(support.reason);
      setPhase('unsupported');
      return;
    }
    setSupported(true);
    setUnsupportedReason(null);
    setPhase('idle');
  }, []);

  const reset = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setTranscript('');
    setInterimTranscript('');
    setErrorMessage(null);
    setPhase((prev) => (prev === 'unsupported' ? 'unsupported' : 'idle'));
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor(window);
    if (!Ctor) {
      setSupported(false);
      setPhase('unsupported');
      setUnsupportedReason(
        'This browser does not support speech recognition. Type your question instead.',
      );
      return;
    }

    recognitionRef.current?.abort();
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finals = '';
    setErrorMessage(null);
    setInterimTranscript('');
    setPhase('listening');

    recognition.onresult = (event) => {
      const { finalText, interimText } = transcriptFromRecognitionResults(
        event.results,
        event.resultIndex,
      );
      if (finalText) {
        finals = normalizeVoiceTranscript(`${finals} ${finalText}`);
        setTranscript(finals);
      }
      setInterimTranscript(interimText);
    };

    recognition.onerror = (event) => {
      const code = event.error ?? 'error';
      if (code === 'aborted' || code === 'no-speech') {
        setPhase(finals ? 'preview' : 'idle');
        return;
      }
      setErrorMessage(
        code === 'not-allowed'
          ? 'Microphone permission blocked. Allow mic access or type your question.'
          : `Voice capture failed (${code}). You can type instead.`,
      );
      setPhase('error');
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      const text = normalizeVoiceTranscript(finals);
      if (text) {
        setTranscript(text);
        setPhase('preview');
      } else {
        setPhase((prev) => (prev === 'error' ? 'error' : 'idle'));
      }
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setErrorMessage('Could not start the microphone. Try again or type.');
      setPhase('error');
    }
  }, [lang]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  return {
    supported,
    unsupportedReason,
    phase,
    statusLabel: voiceCaptureStatusLabel(phase),
    transcript,
    interimTranscript,
    errorMessage,
    startListening,
    stopListening,
    reset,
    setTranscript,
  };
}
