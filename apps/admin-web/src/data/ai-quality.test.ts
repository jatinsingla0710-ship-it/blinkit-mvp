import { describe, expect, it } from 'vitest';
import { matchBusinessChatIntent } from '@/data/business-chat';
import { SENSITIVE_CONFIRM_ACTIONS } from '@/data/ai-tool-permissions';
import {
  AI_ASSISTED_SURFACES,
  AI_QUALITY_IMPROVEMENT_BACKLOG,
  AI_QUALITY_INVARIANTS,
  PHASE_28_AI_QUALITY_HONESTY,
  allAiSurfacesRequireConfirmWhenPosting,
  matchConfidenceBadge,
  qualityBandFromMatchConfidence,
  requiresOwnerConfirmBeforePost,
} from './ai-quality';

describe('Phase 28 AI quality / monitoring', () => {
  it('maps extract match confidence to high / medium / low bands', () => {
    expect(qualityBandFromMatchConfidence('exact')).toBe('high');
    expect(qualityBandFromMatchConfidence('partial')).toBe('medium');
    expect(qualityBandFromMatchConfidence('none')).toBe('low');
    expect(matchConfidenceBadge('exact').toneClass).toContain('high');
    expect(matchConfidenceBadge('partial').label).toMatch(/Check/i);
    expect(matchConfidenceBadge('none').label).toMatch(/Needs review/i);
  });

  it('always requires owner confirm before money posts', () => {
    expect(requiresOwnerConfirmBeforePost('exact')).toBe(true);
    expect(requiresOwnerConfirmBeforePost('none')).toBe(true);
    expect(allAiSurfacesRequireConfirmWhenPosting()).toBe(true);
    expect(
      SENSITIVE_CONFIRM_ACTIONS.some((a) => a.id === 'bill_scan_confirm'),
    ).toBe(true);
  });

  it('keeps Ask hallucination / SQL prompts as unknown', () => {
    expect(matchBusinessChatIntent('delete from sales')).toBe('unknown');
    expect(matchBusinessChatIntent('run sql select * from payments')).toBe(
      'unknown',
    );
  });

  it('lists monitoring surfaces and an honest improvement backlog', () => {
    expect(AI_ASSISTED_SURFACES.length).toBeGreaterThanOrEqual(6);
    expect(AI_QUALITY_IMPROVEMENT_BACKLOG.some((b) => b.id === 'ocr_provider')).toBe(
      true,
    );
    expect(AI_QUALITY_INVARIANTS.length).toBeGreaterThanOrEqual(5);
    expect(PHASE_28_AI_QUALITY_HONESTY).toMatch(/not model accuracy/i);
  });
});
