import { describe, expect, it } from 'vitest';
import type { Permission } from '@groaurum/auth';
import { hasPermission } from '@groaurum/auth';
import {
  BUSINESS_CHAT_INTENT_PERMISSION,
  SENSITIVE_CONFIRM_ACTIONS,
  buildBusinessChatPermissionDeniedAnswer,
  canAnswerBusinessChatIntent,
  filterBusinessChatPresetsForPermissions,
  permissionForBusinessChatIntent,
} from './ai-tool-permissions';

function checkerForRoles(roles: Parameters<typeof hasPermission>[0]['roles']) {
  return (permission: Permission) => hasPermission({ roles, permission });
}

describe('Phase 24 AI tool permissions', () => {
  it('maps supplier dues Ask intents to payments:view', () => {
    expect(permissionForBusinessChatIntent('owe_suppliers')).toBe(
      'payments:view',
    );
    expect(BUSINESS_CHAT_INTENT_PERMISSION.who_owes_me).toBe('payments:view');
  });

  it('blocks salesman from supplier / receivables Ask answers', () => {
    const salesman = checkerForRoles(['salesman']);
    expect(canAnswerBusinessChatIntent('owe_suppliers', salesman)).toBe(false);
    expect(canAnswerBusinessChatIntent('who_owes_me', salesman)).toBe(false);
    expect(canAnswerBusinessChatIntent('sales_yesterday', salesman)).toBe(false);
    expect(canAnswerBusinessChatIntent('unknown', salesman)).toBe(false);
  });

  it('allows sales_manager payments:view intents but not inventory purchase tips without inventory:view', () => {
    const salesManager = checkerForRoles(['sales_manager']);
    expect(canAnswerBusinessChatIntent('owe_suppliers', salesManager)).toBe(
      true,
    );
    expect(canAnswerBusinessChatIntent('who_owes_me', salesManager)).toBe(true);
    expect(canAnswerBusinessChatIntent('profit_this_month', salesManager)).toBe(
      true,
    );
    expect(canAnswerBusinessChatIntent('what_to_buy', salesManager)).toBe(false);
  });

  it('filters Ask presets to intents the role may answer', () => {
    const salesmanPresets = filterBusinessChatPresetsForPermissions(
      checkerForRoles(['salesman']),
    );
    expect(salesmanPresets).toEqual([]);

    const readOnly = filterBusinessChatPresetsForPermissions(
      checkerForRoles(['read_only']),
    );
    expect(readOnly.map((p) => p.id)).toContain('owe_suppliers');
    expect(readOnly.map((p) => p.id)).toContain('what_to_buy');
  });

  it('builds a denied answer without claiming books tools ran', () => {
    const denied = buildBusinessChatPermissionDeniedAnswer('owe_suppliers');
    expect(denied.summary).toMatch(/cannot answer/i);
    expect(denied.unsupportedDetail).toMatch(/No books tools/i);
    expect(denied.links[0]?.href).toBe('/settings');
  });

  it('lists confirm-only sensitive money actions for honesty', () => {
    expect(SENSITIVE_CONFIRM_ACTIONS.map((a) => a.id)).toEqual([
      'bill_scan_confirm',
      'receipt_scan_confirm',
      'day_book_scan_confirm',
      'payment_proof_confirm',
      'voice_ask_confirm',
    ]);
  });
});
