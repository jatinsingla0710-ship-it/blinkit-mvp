import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { usePermissions } from '@groaurum/auth/react';
import { VoiceCaptureControls } from '@/components/ask/VoiceCaptureControls';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import type { BusinessChatAnswer } from '@/data/business-chat';
import { filterBusinessChatPresetsForPermissions } from '@/data/ai-tool-permissions';
import { useAnswerBusinessChatMutation } from '@/data/hooks';
import { useVoiceCapture } from '@/data/useVoiceCapture';
import { ACCOUNTING_SECTION_LINKS } from '@/data/section-links';
import './BusinessChatPage.css';

export function BusinessChatPage() {
  const [draft, setDraft] = useState('Sales yesterday?');
  const [answer, setAnswer] = useState<BusinessChatAnswer | null>(null);
  const ask = useAnswerBusinessChatMutation();
  const voice = useVoiceCapture({ lang: 'en-IN' });
  const { hasPermission } = usePermissions();
  const presets = useMemo(
    () => filterBusinessChatPresetsForPermissions(hasPermission),
    [hasPermission],
  );

  const runAsk = async (question: string) => {
    const q = question.trim();
    if (!q) return;
    setDraft(q);
    try {
      const result = await ask.mutateAsync(q);
      setAnswer(result);
    } catch {
      setAnswer(null);
    }
  };

  return (
    <div className="ga-business-chat">
      <PageHeader
        title="Ask your books"
        subtitle="Ask owner questions like sales, dues, profit, or what to buy. Answers come from typed books tools — never from SQL generated from your prompt. Answers respect your role permissions. You can also speak, then confirm what was heard."
      />
      <SectionRelatedLinks links={[...ACCOUNTING_SECTION_LINKS]} />

      {presets.length > 0 ? (
        <div className="ga-business-chat__presets" aria-label="Suggested questions">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="ga-business-chat__chip"
              onClick={() => {
                void runAsk(preset.example);
              }}
              disabled={ask.isPending}
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No Ask presets for your role"
          detail="Your permissions do not unlock books Q&A chips. Open Settings → Roles & Permissions, or ask an admin."
        />
      )}

      <form
        className="ga-business-chat__form"
        onSubmit={(e) => {
          e.preventDefault();
          void runAsk(draft);
        }}
      >
        <label className="ga-business-chat__label" htmlFor="ga-ask-input">
          Question
        </label>
        <div className="ga-business-chat__row">
          <input
            id="ga-ask-input"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Who owes me? What is profit this month?"
            disabled={ask.isPending}
          />
          <Button type="submit" disabled={ask.isPending || !draft.trim()}>
            {ask.isPending ? 'Looking up…' : 'Ask'}
          </Button>
        </div>
      </form>

      <VoiceCaptureControls
        voice={voice}
        disabled={ask.isPending}
        onConfirm={(transcript) => {
          setDraft(transcript);
          void runAsk(transcript);
          voice.reset();
        }}
      />

      {ask.isError ? (
        <EmptyState
          title="Could not answer"
          detail={
            ask.error instanceof Error
              ? ask.error.message
              : 'Books tools failed to load.'
          }
        />
      ) : null}

      {answer ? (
        <section className="ga-business-chat__answer" aria-live="polite">
          <h2 className="ga-business-chat__answer-title">{answer.matchedLabel}</h2>
          <p className="ga-business-chat__summary">{answer.summary}</p>
          <p className="ga-business-chat__honesty">{answer.honestyNote}</p>
          {answer.unsupportedDetail ? (
            <p className="ga-business-chat__unsupported">
              {answer.unsupportedDetail}
            </p>
          ) : null}
          {answer.lines.length > 0 ? (
            <dl className="ga-business-chat__lines">
              {answer.lines.map((line) => (
                <div key={`${line.label}-${line.value}`}>
                  <dt>{line.label}</dt>
                  <dd>{line.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {answer.links.length > 0 ? (
            <p className="ga-business-chat__links">
              {answer.links.map((link, index) => (
                <span key={link.href}>
                  {index > 0 ? ' · ' : null}
                  <Link to={link.href}>{link.label}</Link>
                </span>
              ))}
            </p>
          ) : null}
        </section>
      ) : !ask.isPending && !ask.isError ? (
        <EmptyState
          title="Pick a question"
          detail="Use a preset, type a question, or speak and confirm. Only mapped intents are answered from your books — and only if your role allows that money view."
        />
      ) : null}
    </div>
  );
}
