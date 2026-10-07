/**
 * Phase 27 — Production QA / Migration readiness.
 * File-local contracts only. Never claims hosted migrate/deploy succeeded.
 */

export type ProductionGateSeverity = 'must' | 'should';

export type ProductionQaCheck = {
  id: string;
  severity: ProductionGateSeverity;
  label: string;
  detail: string;
};

/** Explicit honesty — update only after human-verified ops actions. */
export type DeploymentStatusClaim = {
  committed: 'YES' | 'NO' | 'UNKNOWN';
  pushed: 'YES' | 'NO' | 'UNKNOWN';
  deployed: 'YES' | 'NO' | 'UNKNOWN';
  hostedMigrationApplied: 'YES' | 'NO' | 'UNKNOWN';
};

/**
 * Default claim for agent reports until an operator verifies otherwise.
 * Phase 27 never flips these to YES by itself.
 */
export const DEFAULT_DEPLOYMENT_STATUS_CLAIM: DeploymentStatusClaim = {
  committed: 'NO',
  pushed: 'NO',
  deployed: 'NO',
  hostedMigrationApplied: 'UNKNOWN',
};

export const PRODUCTION_SAFETY_RULES = [
  'Never apply a database migration to production without explicit owner confirmation.',
  'Never claim “deployed” unless deployment actually occurred and was verified.',
  'Never claim “hosted migration applied” unless verified against the hosted project.',
  'Before hosted migrate: backup → review SQL → staging apply → reconcile → rollback plan.',
  'Production Admin builds require VITE_DATA_ADAPTER=supabase (mock is blocked).',
] as const;

/**
 * RichlyBook accounting + AI scan migrations that must exist in-repo
 * and be considered for hosted apply (operator action — not automatic).
 */
export const RICHLYBOOK_HOSTED_MIGRATION_CANDIDATES = [
  '20260930120000_company_expenses.sql',
  '20261001120000_salesman_payroll.sql',
  '20261002120000_suppliers_purchasing.sql',
  '20261002160000_supplier_payables.sql',
  '20261002210000_inventory_valuation_wac.sql',
  '20261002220000_double_entry_accounting.sql',
  '20261002230000_cash_bank.sql',
  '20261003010000_gst_foundation.sql',
  '20261003020000_purchase_bill_scans.sql',
  '20261003030000_expense_receipt_scans.sql',
  '20261003040000_day_book_scans.sql',
  '20261003050000_payment_proof_scans.sql',
] as const;

/** Tables that Admin already degrades to zero-count when missing on host. */
export const GRACEFUL_MISSING_SCAN_TABLES = [
  'purchase_bill_scans',
  'expense_receipt_scans',
  'day_book_scans',
  'payment_proof_scans',
] as const;

export const PRODUCTION_QA_CHECKS: readonly ProductionQaCheck[] = [
  {
    id: 'backup',
    severity: 'must',
    label: 'Database backup before hosted migrate',
    detail: 'Confirm automated backups / PITR, then snapshot if migrating.',
  },
  {
    id: 'migration_review',
    severity: 'must',
    label: 'Review migration SQL',
    detail: 'Human review of RICHLYBOOK_HOSTED_MIGRATION_CANDIDATES before apply.',
  },
  {
    id: 'staging_apply',
    severity: 'must',
    label: 'Apply on staging first',
    detail: 'Hosted staging project separate from production.',
  },
  {
    id: 'reconcile',
    severity: 'must',
    label: 'Reconcile after migrate',
    detail: 'Smoke Admin money views, scans, purchases, day book, payables.',
  },
  {
    id: 'rollback_plan',
    severity: 'must',
    label: 'Rollback plan documented',
    detail: 'Known last-good migration + restore path before production apply.',
  },
  {
    id: 'adapter_supabase',
    severity: 'must',
    label: 'Production uses live Supabase adapter',
    detail: 'VITE_DATA_ADAPTER=supabase; mock blocked in production builds.',
  },
  {
    id: 'verify_build',
    severity: 'must',
    label: 'Typecheck / test / build green',
    detail: 'Admin (and affected apps) pass before promoting a deploy.',
  },
  {
    id: 'providers',
    severity: 'should',
    label: 'Provider keys or written waivers',
    detail: 'SMS/WhatsApp/Razorpay configured or honesty stubs accepted for pilot.',
  },
] as const;

export const PHASE_27_PRODUCTION_QA_HONESTY =
  'Phase 27 records production safety rules and in-repo migration candidates. It does not apply hosted migrations, deploy apps, or flip deployment claims to YES. Scan tables already degrade gracefully when missing on host.';

export function mustProductionQaChecks(): ProductionQaCheck[] {
  return PRODUCTION_QA_CHECKS.filter((c) => c.severity === 'must');
}

export function formatDeploymentStatusClaim(
  claim: DeploymentStatusClaim = DEFAULT_DEPLOYMENT_STATUS_CLAIM,
): string {
  return [
    `Committed: ${claim.committed}`,
    `Pushed: ${claim.pushed}`,
    `Deployed: ${claim.deployed}`,
    `Hosted migration applied: ${claim.hostedMigrationApplied}`,
  ].join('\n');
}
