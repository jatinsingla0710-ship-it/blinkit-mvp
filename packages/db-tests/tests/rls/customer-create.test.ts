import { describe, expect, it } from 'vitest';
import { withUserClient } from '../../src/client';
import { createAuthUser } from '../../src/fixtures';

describe('RLS: admin customer create', () => {
  it('allows ADMIN to create a shop customer', async () => {
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `95800${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `95810${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });

    await withUserClient(admin.accessToken, async (client) => {
      const { data: areas } = await client
        .from('service_areas')
        .select('id')
        .eq('is_active', true)
        .limit(1);
      const serviceAreaId = areas?.[0]?.id;
      expect(serviceAreaId).toBeTruthy();

      const { data: created, error } = await client
        .from('shops')
        .insert({
          trade_name: `Admin Shop ${Date.now()}`,
          service_area_id: serviceAreaId,
          assigned_salesman_profile_id: salesman.id,
          delivery_address_line: 'Test Address Line',
          delivery_city: 'New Delhi',
          delivery_state: 'Delhi',
          delivery_pin_code: '110017',
        })
        .select('id, trade_name, service_area_id')
        .single();
      expect(error).toBeNull();
      expect(created?.id).toBeTruthy();
    });
  });

  it('blocks READ_ONLY from inserting shops', async () => {
    const reader = await createAuthUser({
      roles: ['READ_ONLY'],
      mobile: `95820${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });

    await withUserClient(reader.accessToken, async (client) => {
      const { data, error } = await client
        .from('shops')
        .insert({
          trade_name: `Blocked Shop ${Date.now()}`,
          delivery_address_line: 'Test Address Line',
          delivery_city: 'New Delhi',
          delivery_state: 'Delhi',
          delivery_pin_code: '110017',
        })
        .select('id');
      expect(data ?? []).toEqual([]);
      expect(error).not.toBeNull();
    });
  });
});
