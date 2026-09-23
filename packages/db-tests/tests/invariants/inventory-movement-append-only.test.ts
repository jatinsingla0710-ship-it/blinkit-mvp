import { describe, expect, it } from 'vitest';
import { isPgError } from '../../src/env';
import { getPool } from '../../src/client';
import {
  createAuthUser,
  insertMinimalCatalogue,
  insertOperationalLocation,
} from '../../src/fixtures';

describe('inventory movement append-only', () => {
  it('rejects UPDATE and DELETE on inventory_movements', async () => {
    const pool = getPool();
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `93${Math.floor(Math.random() * 1e8)
        .toString()
        .padStart(8, '0')}`,
    });
    const { skuId } = await insertMinimalCatalogue(pool);
    const locationId = await insertOperationalLocation(pool);

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO public.inventory_movements (
         sku_id, operational_location_id, movement_type, quantity_delta, actor_profile_id
       ) VALUES ($1, $2, 'RECEIPT', 10, $3)
       RETURNING id`,
      [skuId, locationId, admin.id],
    );
    const movementId = rows[0].id;

    await expect(
      pool.query(`UPDATE public.inventory_movements SET quantity_delta = 5 WHERE id = $1`, [
        movementId,
      ]),
    ).rejects.toSatisfy((error: unknown) => isPgError(error, '23001'));

    await expect(
      pool.query(`DELETE FROM public.inventory_movements WHERE id = $1`, [movementId]),
    ).rejects.toSatisfy((error: unknown) => isPgError(error, '23001'));
  });
});
