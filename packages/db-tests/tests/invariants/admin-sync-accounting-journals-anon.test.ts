import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  getDbTestConfig,
  getPool,
  getServiceClient,
  withUserClient,
} from '../../src/client';
import { createAuthUser } from '../../src/fixtures';

const SYNC_FN =
  'public.admin_sync_accounting_journals(date, date)';

describe('Phase 7B.3D: admin_sync_accounting_journals anon EXECUTE', () => {
  it('anon lacks EXECUTE; authenticated and service_role retain EXECUTE', async () => {
    const pool = getPool();
    const { rows } = await pool.query<{
      anon_exec: boolean;
      auth_exec: boolean;
      service_exec: boolean;
      identity_args: string;
    }>(
      `SELECT
         has_function_privilege('anon', $1, 'EXECUTE') AS anon_exec,
         has_function_privilege('authenticated', $1, 'EXECUTE') AS auth_exec,
         has_function_privilege('service_role', $1, 'EXECUTE') AS service_exec,
         pg_get_function_identity_arguments(p.oid) AS identity_args
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname = 'admin_sync_accounting_journals'`,
      [SYNC_FN],
    );

    expect(rows.length).toBe(1);
    expect(rows[0].identity_args).toBe('p_date_from date, p_date_to date');
    expect(rows[0].anon_exec).toBe(false);
    expect(rows[0].auth_exec).toBe(true);
    expect(rows[0].service_exec).toBe(true);
  });

  it('anon PostgREST client cannot call admin_sync_accounting_journals', async () => {
    const { supabaseUrl, anonKey } = getDbTestConfig();
    const anon = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await anon.rpc('admin_sync_accounting_journals', {
      p_date_from: '2026-10-14',
      p_date_to: '2026-10-14',
    });

    expect(error).toBeTruthy();
    expect(error?.message ?? '').toMatch(
      /permission denied|not authorized|42501|Could not find/i,
    );
  });

  it('service_role retains EXECUTE but non-admin call is rejected by is_admin', async () => {
    const service = getServiceClient();
    const { error } = await service.rpc('admin_sync_accounting_journals', {
      p_date_from: '2026-10-14',
      p_date_to: '2026-10-14',
    });
    // Privilege exists; admin gate should still block service_role without admin JWT.
    expect(error).toBeTruthy();
    expect(error?.message ?? '').toMatch(/Only admin can sync accounting journals/i);
  });

  it('admin sync RPC still succeeds after anon revoke', async () => {
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `982${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });

    await withUserClient(
      admin.accessToken,
      async (client) => {
        const sync = await client.rpc('admin_sync_accounting_journals', {
          p_date_from: '2026-10-14',
          p_date_to: '2026-10-14',
        });
        expect(sync.error).toBeNull();
        expect(sync.data).toMatchObject({
          dateFrom: '2026-10-14',
          dateTo: '2026-10-14',
        });
        expect(typeof (sync.data as { posted?: unknown }).posted).toBe('number');
        expect(typeof (sync.data as { skipped?: unknown }).skipped).toBe('number');
      },
      { refreshToken: admin.refreshToken },
    );
  });
});
