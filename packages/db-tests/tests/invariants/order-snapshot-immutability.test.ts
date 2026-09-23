import { describe, expect, it } from 'vitest';
import { isPgError } from '../../src/env';
import { getPool } from '../../src/client';
import {
  createAuthUser,
  createDraftOrder,
  insertMinimalCatalogue,
  insertServiceArea,
  insertShop,
  setOrderStatusTrusted,
} from '../../src/fixtures';

describe('order snapshot immutability', () => {
  it('rejects mutation of commercial snapshot fields after CONFIRMED', async () => {
    const pool = getPool();
    const serviceAreaId = await insertServiceArea(pool, 'Snapshot');
    const shopId = await insertShop(pool, { serviceAreaId });
    const { skuId } = await insertMinimalCatalogue(pool);
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `96${Math.floor(Math.random() * 1e8)
        .toString()
        .padStart(8, '0')}`,
    });

    const { orderId, lineId } = await createDraftOrder(pool, {
      shopId,
      serviceAreaId,
      createdByProfileId: salesman.id,
      skuId,
    });

    await setOrderStatusTrusted(pool, orderId, 'CONFIRMED');

    await expect(
      pool.query(
        `UPDATE public.order_lines SET agreed_unit_price = 999.00, line_total = 999.00 WHERE id = $1`,
        [lineId],
      ),
    ).rejects.toSatisfy((error: unknown) => isPgError(error, '23001'));
  });
});
