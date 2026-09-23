import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const fixMigration = join(
  root,
  'supabase/migrations/20260827220000_fix_convert_sale_audit_log_signature.sql',
);
const priorBroken = join(
  root,
  'supabase/migrations/20260827210000_fix_complete_stop_sale_event_23514.sql',
);
const auditDef = join(
  root,
  'supabase/migrations/20260716210001_sprint9_production_services.sql',
);

/**
 * Regression: try_auto_convert_order_to_sale failed with
 *   function write_audit_log(unknown, unknown, uuid, jsonb, uuid, text) does not exist
 * because CASE ... END typed the 6th arg as text; real signature needs staff_role.
 */
describe('sale conversion write_audit_log signature', () => {
  it('canonical write_audit_log is (text,text,uuid,jsonb,uuid,staff_role)', () => {
    const sql = readFileSync(auditDef, 'utf8');
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.write_audit_log\(\s*p_action text,\s*p_entity_type text,\s*p_entity_id uuid,\s*p_payload jsonb DEFAULT NULL,\s*p_actor_profile_id uuid DEFAULT NULL,\s*p_actor_role public\.staff_role DEFAULT NULL/s,
    );
  });

  it('prior convert core passed untyped CASE as 6th arg (historical cause)', () => {
    const sql = readFileSync(priorBroken, 'utf8');
    expect(sql).toMatch(
      /CASE WHEN public\.is_admin\(\) THEN 'ADMIN' ELSE 'DELIVERY' END/,
    );
  });

  it('fix uses staff_role variable / casts for write_audit_log', () => {
    const sql = readFileSync(fixMigration, 'utf8');
    expect(sql).toMatch(/v_actor_role public\.staff_role/);
    expect(sql).toMatch(/'ADMIN'::public\.staff_role/);
    expect(sql).toMatch(/'DELIVERY'::public\.staff_role/);
    expect(sql).toMatch(/'order\.converted_to_sale'::text/);
    expect(sql).toMatch(/'order'::text/);
    expect(sql).toMatch(/PERFORM public\.write_audit_log\([\s\S]*v_actor_role\s*\)/);
    expect(sql).not.toMatch(
      /write_audit_log\([\s\S]*CASE WHEN public\.is_admin\(\) THEN 'ADMIN' ELSE 'DELIVERY' END\s*\)/,
    );
  });

  it('idempotent already-converted path remains (sale_id / existing sales)', () => {
    const sql = readFileSync(fixMigration, 'utf8');
    expect(sql).toMatch(/alreadyConverted',\s*true/);
    expect(sql).toMatch(/IF v_order\.sale_id IS NOT NULL/);
    expect(sql).toMatch(/SELECT \* INTO v_sale FROM public\.sales WHERE order_id = p_order_id/);
  });
});
