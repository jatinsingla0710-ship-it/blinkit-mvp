/**
 * Phase 28 — AI quality / monitoring / continuous improvement.
 * Confidence bands for match hints. No LLM accuracy claims.
 * Confirm-only money paths stay required for low/unknown confidence.
 */

export type ExtractMatchConfidence = 'exact' | 'partial' | 'none';

export type AiQualityBand = 'high' | 'medium' | 'low';

export type AiQualityBandView = {
  band: AiQualityBand;
  label: string;
  /** Short owner-facing why. */
  detail: string;
  /** CSS modifier: ga-ai-confidence--high|medium|low */
  toneClass: string;
};

export function qualityBandFromMatchConfidence(
  confidence: ExtractMatchConfidence | null | undefined,
): AiQualityBand {
  switch (confidence) {
    case 'exact':
      return 'high';
    case 'partial':
      return 'medium';
    case 'none':
    default:
      return 'low';
  }
}

export function describeAiQualityBand(band: AiQualityBand): AiQualityBandView {
  switch (band) {
    case 'high':
      return {
        band,
        label: 'High match',
        detail: 'Prefill OK — still review before confirm.',
        toneClass: 'ga-ai-confidence--high',
      };
    case 'medium':
      return {
        band,
        label: 'Check fields',
        detail: 'Highlighted match — edit if wrong.',
        toneClass: 'ga-ai-confidence--medium',
      };
    case 'low':
    default:
      return {
        band,
        label: 'Needs review',
        detail: 'Unknown or weak match — confirm required.',
        toneClass: 'ga-ai-confidence--low',
      };
  }
}

export function matchConfidenceBadge(
  confidence: ExtractMatchConfidence | null | undefined,
): AiQualityBandView {
  return describeAiQualityBand(qualityBandFromMatchConfidence(confidence));
}

/** Low/unknown never auto-posts; medium/high still require owner confirm in RichlyBook. */
export function requiresOwnerConfirmBeforePost(
  _confidence: ExtractMatchConfidence | null | undefined,
): boolean {
  return true;
}

export type AiAssistedSurface = {
  id: string;
  label: string;
  extractorOrEngine: string;
  postsMoney: boolean;
  confirmRequired: boolean;
  monitoringNote: string;
};

/** Owner monitoring inventory — what “AI” surfaces actually do today. */
export const AI_ASSISTED_SURFACES: readonly AiAssistedSurface[] = [
  {
    id: 'bill_scan',
    label: 'Supplier bill photo',
    extractorOrEngine: 'manual / rules match',
    postsMoney: false,
    confirmRequired: true,
    monitoringNote: 'Confirm creates purchase draft only — never receives stock alone.',
  },
  {
    id: 'receipt_scan',
    label: 'Expense receipt photo',
    extractorOrEngine: 'manual / category rules',
    postsMoney: true,
    confirmRequired: true,
    monitoringNote: 'Confirm posts company expense only after owner review.',
  },
  {
    id: 'day_book_scan',
    label: 'Daily book / rojnama',
    extractorOrEngine: 'line-rules parser',
    postsMoney: true,
    confirmRequired: true,
    monitoringNote: 'Photo is archive; typed lines confirm into day book.',
  },
  {
    id: 'payment_proof',
    label: 'Payment proof',
    extractorOrEngine: 'manual / order match',
    postsMoney: true,
    confirmRequired: true,
    monitoringNote: 'Never marks paid from photo alone.',
  },
  {
    id: 'ask_books',
    label: 'Ask your books',
    extractorOrEngine: 'typed intents + books tools',
    postsMoney: false,
    confirmRequired: false,
    monitoringNote: 'Read-only answers; voice requires transcript confirm; RBAC gated.',
  },
  {
    id: 'dues_brief_recs',
    label: 'Dues / brief / purchase / profit assistants',
    extractorOrEngine: 'rules over live books',
    postsMoney: false,
    confirmRequired: false,
    monitoringNote: 'Ranked facts with honesty notes — not demand forecasting or LLM narrative.',
  },
] as const;

/** Continuous-improvement backlog (honest — not shipped as LLM ops). */
export const AI_QUALITY_IMPROVEMENT_BACKLOG = [
  {
    id: 'ocr_provider',
    label: 'Optional OCR provider behind confirm-only extract',
    status: 'not_started' as const,
  },
  {
    id: 'ai_audit_warehouse',
    label: 'Unified AI action audit warehouse (extract → confirm → transaction)',
    status: 'not_started' as const,
  },
  {
    id: 'quality_metrics',
    label: 'Hosted metrics: confirm edits, discard rate, unknown Ask intents',
    status: 'not_started' as const,
  },
  {
    id: 'confidence_ui',
    label: 'Confidence bands on all scan match fields',
    status: 'in_progress' as const,
  },
] as const;

/** Regression invariants from roadmap §44 — encoded for continuous checks. */
export const AI_QUALITY_INVARIANTS = [
  'Extractors default to manual/rules labels — never “AI verified”.',
  'Document scans never post money without an explicit owner confirm.',
  'Ask your books never runs SQL generated from the prompt.',
  'Ask intents respect AppRole permissions (no supplier dues without payments:view).',
  'Unknown / hallucinated questions map to unsupported — no invented books facts.',
  'Voice capture requires Use this question before Ask runs.',
  'Match confidence none/partial/exact maps to low/medium/high quality bands.',
] as const;

export const PHASE_28_AI_QUALITY_HONESTY =
  'RichlyBook assistants are rules + confirm-only extracts today. Confidence bands flag match strength for review — they are not model accuracy scores. There is no hosted AI quality dashboard yet; Settings lists surfaces and the improvement backlog honestly.';

export function allAiSurfacesRequireConfirmWhenPosting(): boolean {
  return AI_ASSISTED_SURFACES.filter((s) => s.postsMoney).every(
    (s) => s.confirmRequired,
  );
}
