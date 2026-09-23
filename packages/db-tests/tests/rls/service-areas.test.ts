import { describe, expect, it } from 'vitest';
import { getPool, withUserClient } from '../../src/client';
import { createAuthUser, insertServiceArea } from '../../src/fixtures';

describe('RLS: service areas', () => {
  it('allows ADMIN to create a service area and PIN_CODE rule', async () => {
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `95400${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });

    await withUserClient(admin.accessToken, async (client) => {
      const { data: area, error: areaError } = await client
        .from('service_areas')
        .insert({
          name: `Admin Area ${Date.now()}`,
          description: 'db-tests isolated row',
        })
        .select('id, name, is_active')
        .single();
      expect(areaError).toBeNull();
      expect(area?.id).toBeTruthy();

      const { data: rule, error: ruleError } = await client
        .from('serviceability_rules')
        .insert({
          service_area_id: area!.id,
          rule_type: 'PIN_CODE',
          config: { pinCodes: ['110017', '110074'] },
        })
        .select('id, config')
        .single();
      expect(ruleError).toBeNull();
      expect(rule?.id).toBeTruthy();

      const { data: updated, error: updateError } = await client
        .from('serviceability_rules')
        .update({ config: { pinCodes: ['110017', '110019', '110074'] } })
        .eq('id', rule!.id)
        .select('config')
        .single();
      expect(updateError).toBeNull();
      expect(updated?.config).toEqual({
        pinCodes: ['110017', '110019', '110074'],
      });
    });
  });

  it('blocks READ_ONLY from writing service areas and PIN rules', async () => {
    const pool = getPool();
    const serviceAreaId = await insertServiceArea(pool, 'Read Only Area');
    const reader = await createAuthUser({
      roles: ['READ_ONLY'],
      mobile: `95500${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });

    await withUserClient(reader.accessToken, async (client) => {
      const { data: createdArea, error: areaError } = await client
        .from('service_areas')
        .insert({ name: `Blocked Area ${Date.now()}` })
        .select('id');
      expect(createdArea ?? []).toEqual([]);
      expect(areaError).not.toBeNull();

      const { data: createdRule, error: ruleError } = await client
        .from('serviceability_rules')
        .insert({
          service_area_id: serviceAreaId,
          rule_type: 'PIN_CODE',
          config: { pinCodes: ['110017'] },
        })
        .select('id');
      expect(createdRule ?? []).toEqual([]);
      expect(ruleError).not.toBeNull();

      const { data: updated, error: updateError } = await client
        .from('service_areas')
        .update({ is_active: false })
        .eq('id', serviceAreaId)
        .select('id');
      expect(updateError).toBeNull();
      expect(updated ?? []).toEqual([]);
    });
  });
});
