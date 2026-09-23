import { describe, expect, it } from 'vitest';
import { isPgError } from '../../src/env';
import { getPool } from '../../src/client';
import { createAuthUser } from '../../src/fixtures';

describe('audit log append-only', () => {
  it('rejects UPDATE and DELETE on audit_logs', async () => {
    const pool = getPool();
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `92${Math.floor(Math.random() * 1e8)
        .toString()
        .padStart(8, '0')}`,
    });

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO public.audit_logs (actor_profile_id, actor_role, action, entity_type, entity_id)
       VALUES ($1, 'ADMIN', 'TEST_ACTION', 'order', gen_random_uuid())
       RETURNING id`,
      [admin.id],
    );
    const auditId = rows[0].id;

    await expect(
      pool.query(`UPDATE public.audit_logs SET action = 'TAMPERED' WHERE id = $1`, [auditId]),
    ).rejects.toSatisfy((error: unknown) => isPgError(error, '23001'));

    await expect(pool.query(`DELETE FROM public.audit_logs WHERE id = $1`, [auditId])).rejects.toSatisfy(
      (error: unknown) => isPgError(error, '23001'),
    );
  });
});
