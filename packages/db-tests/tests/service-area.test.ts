import { describe, expect, it } from 'vitest';
import { isPgError } from '../src/env';
import { getPool } from '../src/client';

describe('service area schema proof', () => {
  it('accepts active and inactive service areas', async () => {
    const pool = getPool();
    const active = (
      await pool.query<{ id: string; is_active: boolean }>(
        `INSERT INTO public.service_areas (name, is_active)
         VALUES ($1, true) RETURNING id, is_active`,
        [`Active-${Date.now()}`],
      )
    ).rows[0];
    const inactive = (
      await pool.query<{ id: string; is_active: boolean }>(
        `INSERT INTO public.service_areas (name, is_active)
         VALUES ($1, false) RETURNING id, is_active`,
        [`Inactive-${Date.now()}`],
      )
    ).rows[0];

    expect(active.is_active).toBe(true);
    expect(inactive.is_active).toBe(false);
  });

  it('accepts PIN_CODE and ADMIN_AREA rule configurations', async () => {
    const pool = getPool();
    const serviceAreaId = (
      await pool.query<{ id: string }>(
        `INSERT INTO public.service_areas (name) VALUES ($1) RETURNING id`,
        [`Rules-${Date.now()}`],
      )
    ).rows[0].id;

    const pinRule = await pool.query(
      `INSERT INTO public.serviceability_rules (service_area_id, rule_type, config)
       VALUES ($1, 'PIN_CODE', '{"pinCodes":["110017","110020"]}'::jsonb)`,
      [serviceAreaId],
    );
    expect(pinRule.rowCount).toBe(1);

    const adminRule = await pool.query(
      `INSERT INTO public.serviceability_rules (service_area_id, rule_type, config)
       VALUES ($1, 'ADMIN_AREA', '{"areaCodes":["DL-SOUTH"]}'::jsonb)`,
      [serviceAreaId],
    );
    expect(adminRule.rowCount).toBe(1);
  });

  it('rejects invalid PIN_CODE and ADMIN_AREA configurations', async () => {
    const pool = getPool();
    const serviceAreaId = (
      await pool.query<{ id: string }>(
        `INSERT INTO public.service_areas (name) VALUES ($1) RETURNING id`,
        [`Invalid-${Date.now()}`],
      )
    ).rows[0].id;

    await expect(
      pool.query(
        `INSERT INTO public.serviceability_rules (service_area_id, rule_type, config)
         VALUES ($1, 'PIN_CODE', '{}'::jsonb)`,
        [serviceAreaId],
      ),
    ).rejects.toSatisfy((error: unknown) => isPgError(error, '23514'));

    await expect(
      pool.query(
        `INSERT INTO public.serviceability_rules (service_area_id, rule_type, config)
         VALUES ($1, 'ADMIN_AREA', '{"areaCodes":[]}'::jsonb)`,
        [serviceAreaId],
      ),
    ).rejects.toSatisfy((error: unknown) => isPgError(error, '23514'));
  });
});
