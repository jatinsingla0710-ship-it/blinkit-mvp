import type { ExtractMatchConfidence } from '@/data/ai-quality';
import { matchConfidenceBadge } from '@/data/ai-quality';
import './MatchConfidenceBadge.css';

type Props = {
  confidence: ExtractMatchConfidence | null | undefined;
  /** Optional field name for screen readers. */
  fieldLabel?: string;
};

/** Phase 28 — visual confidence band for extract match hints. */
export function MatchConfidenceBadge({ confidence, fieldLabel }: Props) {
  const view = matchConfidenceBadge(confidence);
  const label = fieldLabel
    ? `${fieldLabel}: ${view.label}`
    : view.label;

  return (
    <span
      className={`ga-ai-confidence ${view.toneClass}`}
      title={view.detail}
      aria-label={label}
    >
      {view.label}
    </span>
  );
}
