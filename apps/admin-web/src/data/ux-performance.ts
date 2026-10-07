/**
 * Phase 25 — mobile-friendly document scan capture attrs.
 * Prefer rear camera on phones; still allows gallery pick.
 */

export const SCAN_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

/** HTML capture hint for phone cameras (ignored on desktop file pickers). */
export const SCAN_IMAGE_CAPTURE = 'environment' as const;

export type ScanImageInputAttrs = {
  accept: typeof SCAN_IMAGE_ACCEPT;
  capture: typeof SCAN_IMAGE_CAPTURE;
};

export function scanImageInputAttrs(): ScanImageInputAttrs {
  return {
    accept: SCAN_IMAGE_ACCEPT,
    capture: SCAN_IMAGE_CAPTURE,
  };
}

/** Read-only AI context cache window — Ask mutations stay uncached. */
export const AI_READONLY_STALE_MS = 120_000;

export const PHASE_25_UX_HONESTY =
  'Admin pages lazy-load behind Suspense. Read-only briefs/assistants reuse a short React Query cache. Ask your books answers are never cached as financial truth. Scan uploads prefer the phone camera when available.';
