import { describe, expect, it } from 'vitest';
import { getPool, withUserClient } from '../../src/client';
import {
  assignSalesman,
  createAuthUser,
  insertServiceArea,
  insertShop,
} from '../../src/fixtures';

describe('salesman shop delivery location', () => {
  it('create retailer stores optional delivery_lat/lng', async () => {
    const pool = getPool();
    const serviceAreaId = await insertServiceArea(pool, 'Sales GPS Create');
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `974${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });

    const pin = '110017';
    let shopId = '';

    await withUserClient(salesman.accessToken, async (client) => {
      const { data, error } = await client.rpc('salesman_create_retailer', {
        p_trade_name: `GPS Shop ${Date.now()}`,
        p_primary_contact_name: 'Owner',
        p_primary_contact_mobile: salesman.mobile,
        p_delivery_address_line: '12 Market Road',
        p_delivery_city: 'New Delhi',
        p_delivery_state: 'Delhi',
        p_delivery_pin_code: pin,
        p_service_area_id: serviceAreaId,
        p_legal_name: null,
        p_delivery_lat: 28.6139,
        p_delivery_lng: 77.209,
      });
      expect(error).toBeNull();
      shopId = data as string;
      expect(shopId).toBeTruthy();
    });

    const { rows } = await pool.query<{
      delivery_lat: number | null;
      delivery_lng: number | null;
    }>(
      `SELECT delivery_lat, delivery_lng FROM public.shops WHERE id = $1`,
      [shopId],
    );
    expect(rows[0]?.delivery_lat).toBeCloseTo(28.6139, 4);
    expect(rows[0]?.delivery_lng).toBeCloseTo(77.209, 4);
  });

  it('set location updates assigned shop only', async () => {
    const pool = getPool();
    const serviceAreaId = await insertServiceArea(pool, 'Sales GPS Update');
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `975${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const other = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `976${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, '0')}`,
    });
    const assignedShop = await insertShop(pool, { serviceAreaId });
    const otherShop = await insertShop(pool, { serviceAreaId });
    await assignSalesman(pool, assignedShop, salesman.id);
    await assignSalesman(pool, otherShop, other.id);

    await withUserClient(salesman.accessToken, async (client) => {
      const { data, error } = await client.rpc(
        'salesman_set_shop_delivery_location',
        {
          p_shop_id: assignedShop,
          p_delivery_lat: 28.7,
          p_delivery_lng: 77.1,
        },
      );
      expect(error).toBeNull();
      expect(data).toMatchObject({
        shopId: assignedShop,
        deliveryLat: 28.7,
        deliveryLng: 77.1,
      });

      const denied = await client.rpc('salesman_set_shop_delivery_location', {
        p_shop_id: otherShop,
        p_delivery_lat: 1,
        p_delivery_lng: 1,
      });
      expect(denied.error).toBeTruthy();
    });

    const { rows } = await pool.query<{
      delivery_lat: number | null;
      delivery_lng: number | null;
    }>(
      `SELECT delivery_lat, delivery_lng FROM public.shops WHERE id = $1`,
      [assignedShop],
    );
    expect(rows[0]?.delivery_lat).toBeCloseTo(28.7, 4);
    expect(rows[0]?.delivery_lng).toBeCloseTo(77.1, 4);
  });
});
