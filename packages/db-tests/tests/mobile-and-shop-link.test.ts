import { describe, expect, it } from 'vitest';
import { isPgError } from '../src/env';
import { getPool } from '../src/client';
import { normalizeMobile } from '../src/fixtures';

describe('normalize_mobile helper', () => {
  it('normalizes +91-prefixed numbers with separators', async () => {
    const canonical = await normalizeMobile('+91 98765 43210');
    expect(canonical).toBe('+919876543210');
  });

  it('normalizes plain 10-digit Indian mobile numbers', async () => {
    const canonical = await normalizeMobile('9876543210');
    expect(canonical).toBe('+919876543210');
  });

  it('normalizes 12-digit numbers starting with 91', async () => {
    const canonical = await normalizeMobile('919876543210');
    expect(canonical).toBe('+919876543210');
  });

  it('normalizes leading-zero 11-digit numbers', async () => {
    const canonical = await normalizeMobile('09876543210');
    expect(canonical).toBe('+919876543210');
  });

  it('rejects unsupported formats', async () => {
    await expect(normalizeMobile('12345')).rejects.toSatisfy((error: unknown) =>
      isPgError(error, '23514'),
    );
  });
});

describe('shop auth link uniqueness', () => {
  it('prevents duplicate active auth links for the same auth user', async () => {
    const pool = getPool();
    const serviceAreaId = (
      await pool.query<{ id: string }>(
        `INSERT INTO public.service_areas (name) VALUES ($1) RETURNING id`,
        [`Link-${Date.now()}`],
      )
    ).rows[0].id;
    const shopA = (
      await pool.query<{ id: string }>(
        `INSERT INTO public.shops (
           trade_name, service_area_id, delivery_address_line, delivery_city, delivery_state, delivery_pin_code
         ) VALUES ($1, $2, 'Line', 'New Delhi', 'Delhi', '110017') RETURNING id`,
        [`ShopA-${Date.now()}`, serviceAreaId],
      )
    ).rows[0].id;
    const shopB = (
      await pool.query<{ id: string }>(
        `INSERT INTO public.shops (
           trade_name, service_area_id, delivery_address_line, delivery_city, delivery_state, delivery_pin_code
         ) VALUES ($1, $2, 'Line', 'New Delhi', 'Delhi', '110020') RETURNING id`,
        [`ShopB-${Date.now()}`, serviceAreaId],
      )
    ).rows[0].id;

    const authUserId = (
      await pool.query<{ id: string }>(
        `INSERT INTO auth.users (
           instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
         ) VALUES (
           '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
           $1, crypt('password', gen_salt('bf')), now(), now(), now()
         ) RETURNING id`,
        [`link-${Date.now()}@groaurum.test`],
      )
    ).rows[0].id;

    const mobile = `+9199${Math.floor(Math.random() * 1e8)
      .toString()
      .padStart(8, '0')}`;

    await pool.query(
      `INSERT INTO public.profiles (id, display_name, mobile, roles)
       VALUES ($1, 'Linked Customer', $2, ARRAY['CUSTOMER']::public.staff_role[])`,
      [authUserId, mobile],
    );

    await pool.query(
      `INSERT INTO public.shop_auth_links (shop_id, auth_user_id) VALUES ($1, $2)`,
      [shopA, authUserId],
    );

    await expect(
      pool.query(`INSERT INTO public.shop_auth_links (shop_id, auth_user_id) VALUES ($1, $2)`, [
        shopB,
        authUserId,
      ]),
    ).rejects.toSatisfy((error: unknown) => isPgError(error, '23505'));
  });
});
