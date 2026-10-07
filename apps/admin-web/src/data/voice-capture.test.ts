import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  detectVoiceCaptureSupport,
  getSpeechRecognitionCtor,
  normalizeVoiceTranscript,
  transcriptFromRecognitionResults,
  voiceCaptureStatusLabel,
} from './voice-capture';

const askPageSource = readFileSync(
  resolve(__dirname, '../pages/ask/BusinessChatPage.tsx'),
  'utf8',
);

describe('Phase 22 voice capture helpers', () => {
  it('wires Speak → confirm into Ask your books', () => {
    expect(askPageSource).toContain('VoiceCaptureControls');
    expect(askPageSource).toContain('useVoiceCapture');
    expect(askPageSource).toContain('onConfirm');
    expect(askPageSource).toMatch(/speak.*confirm/i);
  });

  it('detects missing SpeechRecognition as unsupported', () => {
    expect(detectVoiceCaptureSupport(undefined).supported).toBe(false);
    expect(detectVoiceCaptureSupport({}).supported).toBe(false);
    expect(getSpeechRecognitionCtor({})).toBeNull();
  });

  it('detects webkitSpeechRecognition constructor when present', () => {
    class FakeRec {
      lang = '';
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      start() {}
      stop() {}
      abort() {}
      onresult = null;
      onerror = null;
      onend = null;
    }
    const support = detectVoiceCaptureSupport({
      webkitSpeechRecognition: FakeRec,
    });
    expect(support.supported).toBe(true);
    expect(getSpeechRecognitionCtor({ webkitSpeechRecognition: FakeRec })).toBe(
      FakeRec,
    );
  });

  it('normalizes transcript and splits final vs interim results', () => {
    expect(normalizeVoiceTranscript('  who   owes me  ')).toBe('who owes me');
    const merged = transcriptFromRecognitionResults(
      [
        { isFinal: true, 0: { transcript: 'Who owes' } },
        { isFinal: true, 0: { transcript: 'me' } },
        { isFinal: false, 0: { transcript: 'today' } },
      ],
      0,
    );
    expect(merged.finalText).toBe('Who owes me');
    expect(merged.interimText).toBe('today');
  });

  it('labels capture phases for the owner UI', () => {
    expect(voiceCaptureStatusLabel('listening')).toMatch(/Listening/i);
    expect(voiceCaptureStatusLabel('preview')).toMatch(/Check/i);
    expect(voiceCaptureStatusLabel('unsupported')).toMatch(/not available/i);
  });
});
