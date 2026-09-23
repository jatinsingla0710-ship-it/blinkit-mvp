import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { getDbTestConfig, getPool, getServiceClient, withTrusted } from './client';

export type TestUser = {
  id: string;
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
  mobile: string;
};

export async function createAuthUser(options: {
  roles: Array<'CUSTOMER' | 'SALESMAN' | 'DELIVERY' | 'ADMIN' | 'READ_ONLY'>;
  mobile: string;
  displayName?: string;
}): Promise<TestUser> {
  const id = randomUUID();
  const email = `test-${id}@groaurum.test`;
  const password = `Test-${id.slice(0, 8)}!`;
  const mobile = options.mobile;
  const displayName = options.displayName ?? `Test ${options.roles.join('+')}`;

  const admin = getServiceClient();
  const { error: authError } = await admin.auth.admin.createUser({
    id,
    email,
    password,
    email_confirm: true,
  });
  if (authError) {
    throw authError;
  }

  await getPool().query(
    `INSERT INTO public.profiles (id, display_name, mobile, roles)
     VALUES ($1, $2, public.normalize_mobile($3), $4::public.staff_role[])`,
    [id, displayName, mobile, options.roles],
  );

  const { data: signInData, error: signInError } = await createClient(
    getDbTestConfig().supabaseUrl,
    getDbTestConfig().anonKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  ).auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signInData.session?.access_token || !signInData.session.refresh_token) {
    throw signInError ?? new Error('Failed to sign in test user');
  }

  return {
    id,
    email,
    password,
    accessToken: signInData.session.access_token,
    refreshToken: signInData.session.refresh_token,
    mobile: await normalizeMobile(mobile),
  };
}

export async function normalizeMobile(input: string): Promise<string> {
  const { rows } = await getPool().query<{ mobile: string }>(
    `SELECT public.normalize_mobile($1) AS mobile`,
    [input],
  );
  return rows[0].mobile;
}

export async function insertServiceArea(
  pool: Pool,
  name: string,
  isActive = true,
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO public.service_areas (name, is_active)
     VALUES ($1, $2)
     RETURNING id`,
    [`${name}-${randomUUID().slice(0, 8)}`, isActive],
  );
  return rows[0].id;
}

export async function insertShop(
  pool: Pool,
  options: {
    serviceAreaId: string;
    assignedSalesmanId?: string | null;
    pinCode?: string;
  },
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO public.shops (
       trade_name, service_area_id, assigned_salesman_profile_id,
       delivery_address_line, delivery_city, delivery_state, delivery_pin_code
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      `Shop ${randomUUID().slice(0, 8)}`,
      options.serviceAreaId,
      options.assignedSalesmanId ?? null,
      'Test Address Line 1',
      'New Delhi',
      'Delhi',
      options.pinCode ?? '110017',
    ],
  );
  return rows[0].id;
}

export async function linkShopAuth(pool: Pool, shopId: string, authUserId: string): Promise<void> {
  await pool.query(
    `INSERT INTO public.shop_auth_links (shop_id, auth_user_id) VALUES ($1, $2)`,
    [shopId, authUserId],
  );
}

export async function assignSalesman(
  pool: Pool,
  shopId: string,
  salesmanProfileId: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO public.shop_salesman_assignments (shop_id, salesman_profile_id)
     VALUES ($1, $2)`,
    [shopId, salesmanProfileId],
  );
}

export async function insertMinimalCatalogue(pool: Pool): Promise<{
  categoryId: string;
  productId: string;
  skuId: string;
}> {
  const categoryId = (
    await pool.query<{ id: string }>(
      `INSERT INTO public.categories (name) VALUES ($1) RETURNING id`,
      [`Cat ${randomUUID().slice(0, 8)}`],
    )
  ).rows[0].id;

  const productId = (
    await pool.query<{ id: string }>(
      `INSERT INTO public.products (category_id, name, product_type)
       VALUES ($1, $2, 'BULK') RETURNING id`,
      [categoryId, `Product ${randomUUID().slice(0, 8)}`],
    )
  ).rows[0].id;

  const skuId = (
    await pool.query<{ id: string }>(
      `INSERT INTO public.skus (product_id, sku_code, name, product_type, selling_unit)
       VALUES ($1, $2, $3, 'BULK', 'KG') RETURNING id`,
      [productId, `SKU-${randomUUID().slice(0, 8)}`, 'Test SKU'],
    )
  ).rows[0].id;

  return { categoryId, productId, skuId };
}

export async function insertOperationalLocation(pool: Pool): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO public.operational_locations (name, address_line, city, state, pin_code)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      `Ops ${randomUUID().slice(0, 8)}`,
      'Warehouse Road 1',
      'New Delhi',
      'Delhi',
      '110017',
    ],
  );
  return rows[0].id;
}

export async function createDraftOrder(
  pool: Pool,
  options: {
    shopId: string;
    serviceAreaId: string;
    createdByProfileId: string;
    skuId: string;
    source?: 'CUSTOMER_SELF_SERVE' | 'SALESMAN_ASSISTED';
  },
): Promise<{ orderId: string; lineId: string }> {
  const orderId = (
    await pool.query<{ id: string }>(
      `INSERT INTO public.orders (
         shop_id, service_area_id, created_by_profile_id, source, status,
         subtotal, adjustments, total
       ) VALUES ($1, $2, $3, $4, 'DRAFT_ASSISTED', 100, 0, 100)
       RETURNING id`,
      [
        options.shopId,
        options.serviceAreaId,
        options.createdByProfileId,
        options.source ?? 'SALESMAN_ASSISTED',
      ],
    )
  ).rows[0].id;

  const lineId = (
    await pool.query<{ id: string }>(
      `INSERT INTO public.order_lines (
         order_id, sku_id, product_name_snapshot, sku_name_snapshot, sku_code_snapshot,
         selling_unit_snapshot, quantity, agreed_unit_price, line_total
       ) VALUES ($1, $2, 'Almonds', 'Almond 1kg', 'ALM-1KG', 'KG', 1, 100, 100)
       RETURNING id`,
      [orderId, options.skuId],
    )
  ).rows[0].id;

  return { orderId, lineId };
}

export async function createPaymentForOrder(
  pool: Pool,
  orderId: string,
  status: 'UNPAID' | 'PAID' = 'UNPAID',
): Promise<string> {
  const paymentId = (
    await pool.query<{ id: string }>(
      `INSERT INTO public.payments (order_id, status, method_intent, amount)
       VALUES ($1, 'UNPAID', 'PAY_ON_DELIVERY', 100)
       RETURNING id`,
      [orderId],
    )
  ).rows[0].id;

  await withTrusted(async (client: PoolClient) => {
    await client.query(`UPDATE public.orders SET payment_id = $1 WHERE id = $2`, [
      paymentId,
      orderId,
    ]);
  });

  if (status === 'PAID') {
    await withTrusted(async (client: PoolClient) => {
      await client.query(
        `UPDATE public.payments
         SET status = 'PAID', collection_method = 'CASH_ON_DELIVERY', paid_at = now()
         WHERE id = $1`,
        [paymentId],
      );
    });
  }

  return paymentId;
}

export async function setOrderStatusTrusted(
  pool: Pool,
  orderId: string,
  status: string,
): Promise<void> {
  await withTrusted(async (client: PoolClient) => {
    await client.query(`UPDATE public.orders SET status = $1::public.order_status WHERE id = $2`, [
      status,
      orderId,
    ]);
  });
}

export async function createDeliveryRoute(
  pool: Pool,
  options: {
    serviceAreaId: string;
    deliveryProfileId: string;
    orderId: string;
  },
): Promise<{ routeId: string; stopId: string }> {
  const routeId = (
    await pool.query<{ id: string }>(
      `INSERT INTO public.delivery_routes (service_area_id, route_date, assigned_delivery_profile_id, status)
       VALUES ($1, CURRENT_DATE, $2, 'IN_PROGRESS')
       RETURNING id`,
      [options.serviceAreaId, options.deliveryProfileId],
    )
  ).rows[0].id;

  const stopId = (
    await pool.query<{ id: string }>(
      `INSERT INTO public.route_stops (route_id, order_id, sequence, status)
       VALUES ($1, $2, 1, 'IN_PROGRESS')
       RETURNING id`,
      [routeId, options.orderId],
    )
  ).rows[0].id;

  return { routeId, stopId };
}

export async function insertShopInvitation(
  pool: Pool,
  shopId: string,
  mobile: string,
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO public.shop_invitations (shop_id, mobile, token, expires_at)
     VALUES ($1, public.normalize_mobile($2), $3, now() + interval '7 days')
     RETURNING id`,
    [shopId, mobile, `invite-${randomUUID().replace(/-/g, '')}`],
  );
  return rows[0].id;
}
