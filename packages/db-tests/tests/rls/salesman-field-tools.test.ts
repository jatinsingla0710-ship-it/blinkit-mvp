import { describe, expect, it } from 'vitest';
import { getPool, withUserClient } from '../../src/client';
import { createAuthUser, insertServiceArea, insertShop } from '../../src/fixtures';

const audio = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]);

function mobile(prefix: string): string {
  return `${prefix}${Math.floor(Math.random() * 1e7)
    .toString()
    .padStart(7, '0')}`;
}

describe('salesman messages, voice notes, and notices', () => {
  it('keeps a thread private, stores a voice note, and notifies on review', async () => {
    const pool = getPool();
    const owner = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: mobile('987'),
      displayName: 'Field Owner',
    });
    const other = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: mobile('985'),
      displayName: 'Field Other',
    });
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: mobile('986'),
      displayName: 'Field Admin',
    });
    const serviceAreaId = await insertServiceArea(pool, 'Field Area');
    const shopId = await insertShop(pool, { serviceAreaId, assignedSalesmanId: owner.id });
    const today = (
      await pool.query<{ day: string }>(
        `SELECT (timezone('Asia/Kolkata', now()))::date::text AS day`,
      )
    ).rows[0].day;

    let expenseId = '';
    let voicePath = '';
    await withUserClient(
      owner.accessToken,
      async (client) => {
        const blank = await client.rpc('salesman_send_message', { p_body: '   ' });
        expect(blank.error).not.toBeNull();
        const sent = await client.rpc('salesman_send_message', { p_body: 'Reached the market' });
        expect(sent.error).toBeNull();
        const direct = await client.from('salesman_messages').insert({
          salesman_profile_id: owner.id,
          sender_profile_id: owner.id,
          body: 'nope',
        });
        expect(direct.error).not.toBeNull();

        const created = await client.rpc('salesman_create_expense', {
          p_category: 'PHONE',
          p_amount: 20,
          p_expense_date: today,
        });
        expect(created.error).toBeNull();
        expenseId = (created.data as { id: string }).id;

        const note = await client.rpc('salesman_create_voice_note', {
          p_shop_id: shopId,
          p_visit_id: null,
          p_duration_seconds: 3,
        });
        expect(note.error).toBeNull();
        const noteId = (note.data as { id: string }).id;
        const path = `${owner.id}/${shopId}/voice/${noteId}`;
        voicePath = path;
        const uploaded = await client.storage
          .from('salesman-media')
          .upload(path, audio, { contentType: 'audio/webm', upsert: false });
        expect(uploaded.error).toBeNull();
        const saved = await client.rpc('salesman_set_voice_note_path', {
          p_note_id: noteId,
          p_audio_path: path,
        });
        expect(saved.error).toBeNull();

        const sub = await client.rpc('salesman_save_push_subscription', {
          p_endpoint: 'https://push.example.test/field-owner',
          p_p256dh: 'key',
          p_auth_key: 'auth',
        });
        expect(sub.error).toBeNull();
      },
      { refreshToken: owner.refreshToken },
    );

    await withUserClient(
      other.accessToken,
      async (client) => {
        const hidden = await client.from('salesman_messages').select('id');
        expect(hidden.data ?? []).toEqual([]);
        const voice = await client.storage.from('salesman-media').download(voicePath);
        expect(voice.error).not.toBeNull();
        const keys = await client.from('salesman_push_subscriptions').select('endpoint');
        expect(keys.data ?? []).toEqual([]);
      },
      { refreshToken: other.refreshToken },
    );

    await withUserClient(
      admin.accessToken,
      async (client) => {
        const thread = await client
          .from('salesman_messages')
          .select('body')
          .eq('salesman_profile_id', owner.id);
        expect(thread.data).toEqual([{ body: 'Reached the market' }]);
        const reply = await client.rpc('admin_send_salesman_message', {
          p_salesman_id: owner.id,
          p_body: 'Noted',
        });
        expect(reply.error).toBeNull();
        const review = await client.rpc('admin_review_salesman_expense', {
          p_expense_id: expenseId,
          p_status: 'APPROVED',
          p_review_note: 'Paid later by accounts',
        });
        expect(review.error).toBeNull();
      },
      { refreshToken: admin.refreshToken },
    );

    await withUserClient(
      owner.accessToken,
      async (client) => {
        const notices = await client.from('salesman_notices').select('title, body').order('created_at');
        expect(notices.error).toBeNull();
        const titles = (notices.data ?? []).map((row) => row.title);
        expect(titles).toContain('New message');
        expect(titles).toContain('Expense approved');
      },
      { refreshToken: owner.refreshToken },
    );

  });
});
