import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_DEPLOYMENT_STATUS_CLAIM,
  GRACEFUL_MISSING_SCAN_TABLES,
  PHASE_27_PRODUCTION_QA_HONESTY,
  PRODUCTION_SAFETY_RULES,
  RICHLYBOOK_HOSTED_MIGRATION_CANDIDATES,
  formatDeploymentStatusClaim,
  mustProductionQaChecks,
} from './production-qa';

const migrationsDir = resolve(__dirname, '../../../../supabase/migrations');
const liveAdminApi = readFileSync(
  resolve(__dirname, './live/LiveAdminApi.ts'),
  'utf8',
);
const operationalEnv = readFileSync(
  resolve(__dirname, '../lib/operationalEnv.ts'),
  'utf8',
);

describe('Phase 27 Production QA / Migration', () => {
  it('keeps must-gates and never auto-claims deploy/migrate success', () => {
    expect(mustProductionQaChecks().map((c) => c.id)).toEqual([
      'backup',
      'migration_review',
      'staging_apply',
      'reconcile',
      'rollback_plan',
      'adapter_supabase',
      'verify_build',
    ]);
    expect(DEFAULT_DEPLOYMENT_STATUS_CLAIM).toEqual({
      committed: 'NO',
      pushed: 'NO',
      deployed: 'NO',
      hostedMigrationApplied: 'UNKNOWN',
    });
    expect(formatDeploymentStatusClaim()).toMatch(/Hosted migration applied: UNKNOWN/);
    expect(PHASE_27_PRODUCTION_QA_HONESTY).toMatch(/does not apply hosted migrations/i);
    expect(PRODUCTION_SAFETY_RULES.some((r) => /without explicit owner confirmation/i.test(r))).toBe(
      true,
    );
  });

  it('requires RichlyBook hosted migration candidates to exist as files', () => {
    expect(existsSync(migrationsDir)).toBe(true);
    const onDisk = new Set(
      readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')),
    );
    for (const file of RICHLYBOOK_HOSTED_MIGRATION_CANDIDATES) {
      expect(onDisk.has(file), `missing migration ${file}`).toBe(true);
    }
    // Forward-only timestamps within the RichlyBook candidate set.
    const stamps = RICHLYBOOK_HOSTED_MIGRATION_CANDIDATES.map((f) => f.slice(0, 14));
    expect([...stamps].sort()).toEqual([...stamps]);
  });

  it('documents graceful degrade for missing scan tables on host', () => {
    expect([...GRACEFUL_MISSING_SCAN_TABLES]).toEqual([
      'purchase_bill_scans',
      'expense_receipt_scans',
      'day_book_scans',
      'payment_proof_scans',
    ]);
    expect(liveAdminApi).toMatch(/missing until hosted migration/i);
    for (const table of GRACEFUL_MISSING_SCAN_TABLES) {
      expect(liveAdminApi).toContain(table);
    }
  });

  it('keeps production builds blocked from mock adapter', () => {
    expect(operationalEnv).toMatch(/Production requires VITE_DATA_ADAPTER=supabase/);
  });
});
