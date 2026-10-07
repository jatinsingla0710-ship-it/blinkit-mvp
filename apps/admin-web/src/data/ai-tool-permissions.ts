/**
 * Phase 24 — AI / books-tool permission gates.
 * Ask your books and related assistants must not expose money the role cannot see.
 * Confirm-only write paths stay separate (scans already require owner confirm).
 */

import type { Permission } from '@groaurum/auth';
import type {
  BusinessChatAnswer,
  BusinessChatIntentId,
  BusinessChatPreset,
} from '@/data/business-chat';
import { BUSINESS_CHAT_PRESETS } from '@/data/business-chat';

/** Permission required to answer each Ask intent (view-level). */
export const BUSINESS_CHAT_INTENT_PERMISSION: Record<
  BusinessChatIntentId,
  Permission
> = {
  sales_yesterday: 'reports:view',
  cash_today: 'payments:view',
  who_owes_me: 'payments:view',
  total_outstanding: 'payments:view',
  expenses_fuel_month: 'payments:view',
  expenses_why_up: 'reports:view',
  top_product_sales: 'reports:view',
  top_product_margin: 'reports:view',
  what_to_buy: 'inventory:view',
  owe_suppliers: 'payments:view',
  profit_this_month: 'reports:view',
  customers_above_threshold: 'payments:view',
  unknown: 'dashboard:view',
};

/** Owner-facing AI surfaces and the permission that unlocks them. */
export const AI_SURFACE_PERMISSION: Record<
  'ask' | 'brief' | 'dues' | 'purchase_recommend' | 'profit_insights',
  Permission
> = {
  ask: 'dashboard:view',
  brief: 'dashboard:view',
  dues: 'payments:view',
  purchase_recommend: 'inventory:view',
  profit_insights: 'reports:view',
};

/**
 * Sensitive money actions that must never auto-post from AI/OCR alone.
 * Presentation / honesty checklist — enforcement lives in each confirm RPC/UI.
 */
export const SENSITIVE_CONFIRM_ACTIONS = [
  {
    id: 'bill_scan_confirm',
    label: 'Confirm supplier bill scan',
    detail: 'Creates a purchase draft only after owner review.',
  },
  {
    id: 'receipt_scan_confirm',
    label: 'Confirm expense receipt scan',
    detail: 'Posts a company expense only after owner review.',
  },
  {
    id: 'day_book_scan_confirm',
    label: 'Confirm daily book scan',
    detail: 'Writes day-book lines only after owner review.',
  },
  {
    id: 'payment_proof_confirm',
    label: 'Confirm payment proof scan',
    detail: 'Applies collection matching only after owner review.',
  },
  {
    id: 'voice_ask_confirm',
    label: 'Use spoken question',
    detail: 'Voice never runs Ask until the owner confirms the transcript.',
  },
] as const;

export const PHASE_24_SECURITY_HONESTY =
  'Financial reads use AppRole permissions. Live Supabase still enforces RLS and admin RPCs. AI tools do not invent a second permission system — they reuse the same matrix. Document scans and voice never post money without an explicit confirm. Role create/edit is not available yet.';

export function permissionForBusinessChatIntent(
  intentId: BusinessChatIntentId,
): Permission {
  return BUSINESS_CHAT_INTENT_PERMISSION[intentId];
}

export function canAnswerBusinessChatIntent(
  intentId: BusinessChatIntentId,
  hasPermission: (permission: Permission) => boolean,
): boolean {
  return hasPermission(permissionForBusinessChatIntent(intentId));
}

export function filterBusinessChatPresetsForPermissions(
  hasPermission: (permission: Permission) => boolean,
  presets: readonly BusinessChatPreset[] = BUSINESS_CHAT_PRESETS,
): BusinessChatPreset[] {
  return presets.filter((preset) =>
    canAnswerBusinessChatIntent(preset.id, hasPermission),
  );
}

export function buildBusinessChatPermissionDeniedAnswer(
  intentId: BusinessChatIntentId,
): BusinessChatAnswer {
  const permission = permissionForBusinessChatIntent(intentId);
  return {
    intentId,
    matchedLabel: 'Permission required',
    summary: `Your role cannot answer this books question (${permission}). Ask an admin if you need access.`,
    lines: [
      { label: 'Required permission', value: permission },
      {
        label: 'Why',
        value:
          'Ask your books reuses Admin RBAC so money answers stay within what you can already open in RichlyBook.',
      },
    ],
    links: [{ label: 'Roles & Permissions', href: '/settings' }],
    honestyNote: PHASE_24_SECURITY_HONESTY,
    unsupportedDetail:
      intentId === 'unknown'
        ? null
        : 'No books tools were called for this question.',
  };
}
