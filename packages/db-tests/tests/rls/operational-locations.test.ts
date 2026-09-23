import { describe, expect, it } from 'vitest';
import { withUserClient } from '../../src/client';
import { createAuthUser } from '../../src/fixtures';

describe('RLS: operational locations', () => {
  it('allows ADMIN to create and deactivate a warehouse', async () => {
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `95600${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });

    await withUserClient(admin.accessToken, async (client) => {
      const { data: created, error: createError } = await client
        .from('operational_locations')
        .insert({
          name: `Admin Warehouse ${Date.now()}`,
          address_line: 'Test Address Line',
          city: 'New Delhi',
          state: 'Delhi',
          pin_code: '110074',
        })
        .select('id, name, is_active')
        .single();
      expect(createError).toBeNull();
      expect(created?.id).toBeTruthy();

      const { data: updated, error: updateError } = await client
        .from('operational_locations')
        .update({ is_active: false })
        .eq('id', created!.id)
        .select('is_active')
        .single();
      expect(updateError).toBeNull();
      expect(updated?.is_active).toBe(false);
    });
  });

  it('blocks READ_ONLY from writing operational locations', async () => {
    const reader = await createAuthUser({
      roles: ['READ_ONLY'],
      mobile: `95700${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });

    await withUserClient(reader.accessToken, async (client) => {
      const { data: created, error: createError } = await client
        .from('operational_locations')
        .insert({
          name: `Blocked Warehouse ${Date.now()}`,
          address_line: 'Test Address Line',
          city: 'New Delhi',
          state: 'Delhi',
          pin_code: '110074',
        })
        .select('id');
      expect(created ?? []).toEqual([]);
      expect(createError).not.toBeNull();

      const { data: listed } = await client
        .from('operational_locations')
        .select('id')
        .limit(1);
      expect(listed ?? []).toEqual([]);
    });
  });
});
