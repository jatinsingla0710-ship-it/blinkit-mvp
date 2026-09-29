import { describe, expect, it } from 'vitest';
import { getPool, withUserClient } from '../../src/client';
import { expectRlsBlocksUpdate } from '../../src/rls-assertions';
import {
  assignSalesman,
  createAuthUser,
  insertServiceArea,
  insertShop,
} from '../../src/fixtures';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

async function salesmanWithShop(label: string) {
  const pool = getPool();
  const serviceAreaId = await insertServiceArea(pool, `${label} ${Date.now()}`);
  const salesman = await createAuthUser({
    roles: ['SALESMAN'],
    mobile: `98${Math.floor(10000000 + Math.random() * 89999999)}`,
  });
  await pool.query(
    `INSERT INTO public.salesman_employment (profile_id) VALUES ($1)`,
    [salesman.id],
  );
  const shopId = await insertShop(pool, { serviceAreaId });
  await assignSalesman(pool, shopId, salesman.id);
  const visitId = (
    await pool.query<{ id: string }>(
      `INSERT INTO public.sales_visits (salesman_profile_id, shop_id, planned_at, notes)
       VALUES ($1, $2, now(), 'Keep this note')
       RETURNING id`,
      [salesman.id, shopId],
    )
  ).rows[0].id;
  return { pool, salesman, shopId, visitId };
}

describe('salesman visit check-in', () => {
  it('calculates distance and rejects invalid coordinates', async () => {
    const { rows } = await getPool().query<{ metres: number }>(
      `SELECT public.geo_distance_metres(28.6139, 77.2090, 28.6149, 77.2090) AS metres`,
    );
    expect(Number(rows[0].metres)).toBeGreaterThan(100);
    expect(Number(rows[0].metres)).toBeLessThan(125);
    await expect(
      getPool().query(`SELECT public.geo_distance_metres(91, 0, 0, 0)`),
    ).rejects.toThrow(/invalid coordinates/i);
  });

  it('lets an assigned salesman check in and keeps the planned visit', async () => {
    const { pool, salesman, shopId, visitId } = await salesmanWithShop('Check-in');
    const planned = (
      await pool.query<{ planned_at: string }>(
        `SELECT planned_at FROM public.sales_visits WHERE id = $1`,
        [visitId],
      )
    ).rows[0].planned_at;
    await pool.query(
      `UPDATE public.shops SET delivery_lat = 28.6139, delivery_lng = 77.2090 WHERE id = $1`,
      [shopId],
    );

    await withUserClient(
      salesman.accessToken,
      async (client) => {
        const denied = await client.rpc('salesman_check_in_visit', {
          p_visit_id: visitId,
          p_lat: 91,
          p_lng: 77,
        });
        expect(denied.error).not.toBeNull();

        const ok = await client.rpc('salesman_check_in_visit', {
          p_visit_id: visitId,
          p_lat: 28.6149,
          p_lng: 77.209,
        });
        expect(ok.error).toBeNull();
        const body = ok.data as {
          distanceMetres: number;
          gpsVerification: string;
          latitude: number;
        };
        expect(body.gpsVerification).toBe('verified');
        expect(body.latitude).toBeCloseTo(28.6149);
        expect(body.distanceMetres).toBeGreaterThan(100);
        expect(body.distanceMetres).toBeLessThan(125);
      },
      { refreshToken: salesman.refreshToken },
    );

    const stored = (
      await pool.query<{
        notes: string;
        planned_at: string;
        check_in_lat: number;
        status: string;
      }>(
        `SELECT notes, planned_at, check_in_lat, status FROM public.sales_visits WHERE id = $1`,
        [visitId],
      )
    ).rows[0];
    expect(stored.notes).toBe('Keep this note');
    expect(new Date(stored.planned_at).toISOString()).toBe(new Date(planned).toISOString());
    expect(Number(stored.check_in_lat)).toBeCloseTo(28.6149);
    expect(stored.status).toBe('PLANNED');
  });

  it('returns unavailable when the shop has no GPS and does not invent a distance', async () => {
    const { salesman, visitId } = await salesmanWithShop('No GPS');
    await withUserClient(
      salesman.accessToken,
      async (client) => {
        const ok = await client.rpc('salesman_check_in_visit', {
          p_visit_id: visitId,
          p_lat: 28.6,
          p_lng: 77.2,
        });
        expect(ok.error).toBeNull();
        const body = ok.data as { gpsVerification: string; distanceMetres: number | null };
        expect(body.gpsVerification).toBe('unavailable');
        expect(body.distanceMetres).toBeNull();
      },
      { refreshToken: salesman.refreshToken },
    );
  });

  it('blocks another salesman and preserves or clears notes on completion', async () => {
    const { pool, salesman, shopId, visitId } = await salesmanWithShop('Complete');
    await pool.query(
      `UPDATE public.shops SET delivery_lat = 28.6139, delivery_lng = 77.2090 WHERE id = $1`,
      [shopId],
    );
    const other = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `97${Math.floor(10000000 + Math.random() * 89999999)}`,
    });
    await pool.query(
      `INSERT INTO public.salesman_employment (profile_id) VALUES ($1)`,
      [other.id],
    );
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `96${Math.floor(10000000 + Math.random() * 89999999)}`,
    });

    await withUserClient(
      other.accessToken,
      async (client) => {
        const denied = await client.rpc('salesman_check_in_visit', {
          p_visit_id: visitId,
          p_lat: 28.6149,
          p_lng: 77.209,
        });
        expect(denied.error).not.toBeNull();
        const completeDenied = await client.rpc('salesman_complete_visit', {
          p_visit_id: visitId,
          p_status: 'VISITED',
          p_lat: 28.6149,
          p_lng: 77.209,
        });
        expect(completeDenied.error).not.toBeNull();
        await expectRlsBlocksUpdate(async () =>
          client
            .from('sales_visits')
            .update({ notes: 'stolen' })
            .eq('id', visitId)
            .select('id'),
        );
      },
      { refreshToken: other.refreshToken },
    );

    await withUserClient(
      salesman.accessToken,
      async (client) => {
        const checked = await client.rpc('salesman_check_in_visit', {
          p_visit_id: visitId,
          p_lat: 28.6149,
          p_lng: 77.209,
        });
        expect(checked.error).toBeNull();

        const kept = await client.rpc('salesman_complete_visit', {
          p_visit_id: visitId,
          p_status: 'VISITED',
          p_lat: 28.6149,
          p_lng: 77.209,
          p_update_notes: false,
        });
        expect(kept.error).toBeNull();
        expect((kept.data as { notes: string; status: string }).notes).toBe('Keep this note');
        expect((kept.data as { status: string }).status).toBe('VISITED');
        expect((kept.data as { latitude: number }).latitude).toBeCloseTo(28.6149);
      },
      { refreshToken: salesman.refreshToken },
    );

    const completed = (
      await pool.query<{ completion_lat: number; notes: string; planned_at: string }>(
        `SELECT completion_lat, notes, planned_at FROM public.sales_visits WHERE id = $1`,
        [visitId],
      )
    ).rows[0];
    expect(Number(completed.completion_lat)).toBeCloseTo(28.6149);
    expect(completed.notes).toBe('Keep this note');

    const closedVisit = (
      await pool.query<{ id: string }>(
        `INSERT INTO public.sales_visits (salesman_profile_id, shop_id, planned_at, notes)
         VALUES ($1, $2, now(), 'Close me')
         RETURNING id`,
        [salesman.id, shopId],
      )
    ).rows[0].id;

    await withUserClient(
      salesman.accessToken,
      async (client) => {
        expect(
          (
            await client.rpc('salesman_check_in_visit', {
              p_visit_id: closedVisit,
              p_lat: 28.6149,
              p_lng: 77.209,
            })
          ).error,
        ).toBeNull();
        const closed = await client.rpc('salesman_complete_visit', {
          p_visit_id: closedVisit,
          p_status: 'SHOP_CLOSED',
          p_lat: 28.6148,
          p_lng: 77.209,
          p_update_notes: true,
          p_notes: '',
        });
        expect(closed.error).toBeNull();
        const body = closed.data as { status: string; notes: string | null };
        expect(body.status).toBe('SHOP_CLOSED');
        expect(body.notes).toBeNull();
      },
      { refreshToken: salesman.refreshToken },
    );

    await withUserClient(
      admin.accessToken,
      async (client) => {
        const { data, error } = await client
          .from('sales_visits')
          .select('id, status')
          .eq('id', visitId);
        expect(error).toBeNull();
        expect(data).toEqual([{ id: visitId, status: 'VISITED' }]);
      },
      { refreshToken: admin.refreshToken },
    );

    const photoPath = `${salesman.id}/${shopId}/visits/${visitId}`;
    await withUserClient(
      salesman.accessToken,
      async (client) => {
        const ok = await client.storage.from('salesman-media').upload(photoPath, jpeg, {
          contentType: 'image/jpeg',
          upsert: true,
        });
        expect(ok.error).toBeNull();
        const otherFolder = await client.storage
          .from('salesman-media')
          .upload(`${other.id}/${shopId}/visits/${visitId}`, jpeg, {
            contentType: 'image/jpeg',
          });
        expect(otherFolder.error).not.toBeNull();
        const otherShop = await client.storage
          .from('salesman-media')
          .upload(`${salesman.id}/00000000-0000-4000-8000-000000000099/visits/${visitId}`, jpeg, {
            contentType: 'image/jpeg',
          });
        expect(otherShop.error).not.toBeNull();
      },
      { refreshToken: salesman.refreshToken },
    );

    await withUserClient(
      other.accessToken,
      async (client) => {
        const denied = await client.storage.from('salesman-media').download(photoPath);
        expect(denied.error).not.toBeNull();
      },
      { refreshToken: other.refreshToken },
    );
  });

  it('still starts a day when GPS is omitted, and stores GPS when it is sent', async () => {
    const { pool, salesman } = await salesmanWithShop('Attendance');
    await pool.query(
      `UPDATE public.salesman_employment
       SET weekly_off_dow = ((EXTRACT(DOW FROM CURRENT_DATE)::int + 1) % 7),
           working_days = ARRAY[0,1,2,3,4,5,6]::smallint[]
       WHERE profile_id = $1`,
      [salesman.id],
    );
    await withUserClient(
      salesman.accessToken,
      async (client) => {
        const started = await client.rpc('salesman_start_day', {});
        expect(started.error).toBeNull();
        expect((started.data as { status: string }).status).toBe('PRESENT');
      },
      { refreshToken: salesman.refreshToken },
    );
    const row = (
      await pool.query<{ start_lat: number | null }>(
        `SELECT start_lat FROM public.salesman_attendance
         WHERE profile_id = $1 AND work_date = CURRENT_DATE`,
        [salesman.id],
      )
    ).rows[0];
    expect(row.start_lat).toBeNull();

    await pool.query(
      `DELETE FROM public.salesman_attendance WHERE profile_id = $1 AND work_date = CURRENT_DATE`,
      [salesman.id],
    );
    await withUserClient(
      salesman.accessToken,
      async (client) => {
        const invalid = await client.rpc('salesman_start_day', { p_lat: 91, p_lng: 0 });
        expect(invalid.error).not.toBeNull();
        const started = await client.rpc('salesman_start_day', {
          p_lat: 28.6139,
          p_lng: 77.209,
        });
        expect(started.error).toBeNull();
        const ended = await client.rpc('salesman_end_day', {
          p_lat: 28.614,
          p_lng: 77.209,
        });
        expect(ended.error).toBeNull();
      },
      { refreshToken: salesman.refreshToken },
    );
    const stored = (
      await pool.query<{ start_lat: number; end_lat: number }>(
        `SELECT start_lat, end_lat FROM public.salesman_attendance
         WHERE profile_id = $1 AND work_date = CURRENT_DATE`,
        [salesman.id],
      )
    ).rows[0];
    expect(Number(stored.start_lat)).toBeCloseTo(28.6139);
    expect(Number(stored.end_lat)).toBeCloseTo(28.614);
  });
});
