import { describe, expect, it } from 'vitest';
import { getPool, withUserClient } from '../../src/client';
import { expectRlsBlocksUpdate } from '../../src/rls-assertions';
import { createAuthUser } from '../../src/fixtures';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

async function salesman(label: string) {
  const pool = getPool();
  const user = await createAuthUser({
    roles: ['SALESMAN'],
    mobile: `98${Math.floor(10000000 + Math.random() * 89999999)}`,
    displayName: `${label} Sales`,
  });
  await pool.query(`INSERT INTO public.salesman_employment (profile_id) VALUES ($1)`, [user.id]);
  return { pool, user };
}

describe('salesman profile setup', () => {
  it('updates name and language without changing role, mobile, or active status', async () => {
    const { pool, user } = await salesman('Profile');
    const before = (
      await pool.query<{ mobile: string; roles: string[]; is_active: boolean }>(
        `SELECT mobile, roles::text[], is_active FROM public.profiles WHERE id = $1`,
        [user.id],
      )
    ).rows[0];

    await withUserClient(
      user.accessToken,
      async (client) => {
        const bad = await client.rpc('salesman_update_own_profile', {
          p_display_name: 'Asha',
          p_preferred_language: 'fr',
        });
        expect(bad.error).not.toBeNull();

        const foreignPhoto = await client.rpc('salesman_update_own_profile', {
          p_display_name: 'Asha',
          p_preferred_language: 'hi',
          p_update_avatar: true,
          p_avatar_path: '00000000-0000-4000-8000-000000000099/profile',
        });
        expect(foreignPhoto.error).not.toBeNull();

        const ok = await client.rpc('salesman_update_own_profile', {
          p_display_name: 'Asha Verma',
          p_preferred_language: 'hi',
          p_complete_setup: true,
        });
        expect(ok.error).toBeNull();
        const body = ok.data as {
          displayName: string;
          preferredLanguage: string;
          profileSetupCompletedAt: string;
          mobile: string;
        };
        expect(body.displayName).toBe('Asha Verma');
        expect(body.preferredLanguage).toBe('hi');
        expect(body.profileSetupCompletedAt).toBeTruthy();
        expect(body.mobile).toBe(before.mobile);
      },
      { refreshToken: user.refreshToken },
    );

    const after = (
      await pool.query<{
        mobile: string;
        roles: string[];
        is_active: boolean;
        avatar_path: string | null;
        profile_setup_completed_at: string;
      }>(
        `SELECT mobile, roles::text[], is_active, avatar_path, profile_setup_completed_at
         FROM public.profiles WHERE id = $1`,
        [user.id],
      )
    ).rows[0];
    expect(after.mobile).toBe(before.mobile);
    expect(after.roles).toEqual(before.roles);
    expect(after.is_active).toBe(before.is_active);
    expect(after.avatar_path).toBeNull();
    expect(after.profile_setup_completed_at).toBeTruthy();
  });

  it('keeps an existing photo and setup time unless the salesman changes them', async () => {
    const { pool, user } = await salesman('Keep');
    const path = `${user.id}/profile`;
    await pool.query(
      `UPDATE public.profiles
       SET avatar_path = $2,
           profile_setup_completed_at = '2026-01-01T00:00:00Z',
           preferred_language = 'en'
       WHERE id = $1`,
      [user.id, path],
    );

    await withUserClient(
      user.accessToken,
      async (client) => {
        const kept = await client.rpc('salesman_update_own_profile', {
          p_display_name: 'Kept Name',
          p_preferred_language: 'en',
        });
        expect(kept.error).toBeNull();
        const body = kept.data as { avatarPath: string; profileSetupCompletedAt: string };
        expect(body.avatarPath).toBe(path);
        expect(new Date(body.profileSetupCompletedAt).toISOString()).toBe(
          '2026-01-01T00:00:00.000Z',
        );

        const cleared = await client.rpc('salesman_update_own_profile', {
          p_display_name: 'Kept Name',
          p_preferred_language: 'en',
          p_update_avatar: true,
          p_avatar_path: '',
        });
        expect(cleared.error).toBeNull();
        expect((cleared.data as { avatarPath: string | null }).avatarPath).toBeNull();
      },
      { refreshToken: user.refreshToken },
    );
  });

  it('blocks another salesman, a direct role change, and a foreign profile photo', async () => {
    const { pool, user } = await salesman('Owner');
    const other = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `97${Math.floor(10000000 + Math.random() * 89999999)}`,
    });
    await pool.query(`INSERT INTO public.salesman_employment (profile_id) VALUES ($1)`, [other.id]);
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `96${Math.floor(10000000 + Math.random() * 89999999)}`,
    });
    const customer = await createAuthUser({
      roles: ['CUSTOMER'],
      mobile: `95${Math.floor(10000000 + Math.random() * 89999999)}`,
    });

    await withUserClient(
      other.accessToken,
      async (client) => {
        await expectRlsBlocksUpdate(async () =>
          client
            .from('profiles')
            .update({ display_name: 'Stolen' })
            .eq('id', user.id)
            .select('id'),
        );
      },
      { refreshToken: other.refreshToken },
    );

    await withUserClient(
      user.accessToken,
      async (client) => {
        const roleChange = await client
          .from('profiles')
          .update({ roles: ['ADMIN'] })
          .eq('id', user.id)
          .select('id');
        expect(roleChange.data ?? []).toEqual([]);
        const mobileChange = await client
          .from('profiles')
          .update({ mobile: '919111111111' })
          .eq('id', user.id)
          .select('id');
        expect(mobileChange.data ?? []).toEqual([]);
        const ownPhoto = await client.storage
          .from('salesman-media')
          .upload(`${user.id}/profile`, jpeg, { contentType: 'image/jpeg', upsert: true });
        expect(ownPhoto.error).toBeNull();
        const foreign = await client.storage
          .from('salesman-media')
          .upload(`${other.id}/profile`, jpeg, { contentType: 'image/jpeg' });
        expect(foreign.error).not.toBeNull();
        const saved = await client.rpc('salesman_update_own_profile', {
          p_display_name: 'Owner',
          p_preferred_language: 'en',
          p_update_avatar: true,
          p_avatar_path: `${user.id}/profile`,
          p_complete_setup: true,
        });
        expect(saved.error).toBeNull();
      },
      { refreshToken: user.refreshToken },
    );

    await withUserClient(
      customer.accessToken,
      async (client) => {
        const denied = await client.rpc('salesman_update_own_profile', {
          p_display_name: 'Customer',
          p_preferred_language: 'en',
        });
        expect(denied.error).not.toBeNull();
      },
      { refreshToken: customer.refreshToken },
    );

    await withUserClient(
      admin.accessToken,
      async (client) => {
        const { data, error } = await client
          .from('profiles')
          .select('id, preferred_language, avatar_path')
          .eq('id', user.id);
        expect(error).toBeNull();
        expect(data).toEqual([
          {
            id: user.id,
            preferred_language: 'en',
            avatar_path: `${user.id}/profile`,
          },
        ]);
      },
      { refreshToken: admin.refreshToken },
    );

    await withUserClient(
      other.accessToken,
      async (client) => {
        const hidden = await client.storage.from('salesman-media').download(`${user.id}/profile`);
        expect(hidden.error).not.toBeNull();
      },
      { refreshToken: other.refreshToken },
    );
  });
});
