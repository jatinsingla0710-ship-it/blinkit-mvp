import { describe, expect, it } from 'vitest';
import {
  buildPurchaseRecommendationsSnapshot,
  recommendPurchaseQty,
  type PurchaseSkuSignal,
} from './purchase-recommendations';

function signal(
  partial: Partial<PurchaseSkuSignal> & Pick<PurchaseSkuSignal, 'skuId' | 'status'>,
): PurchaseSkuSignal {
  return {
    productName: 'Almonds',
    skuCode: 'ALM-1',
    skuName: 'Almonds 1kg',
    unitLabel: 'Boxes',
    availablePacks: 0,
    availableLabel: '0 Boxes',
    soldLast28Days: 0,
    openDraftQty: 0,
    lastSupplierId: null,
    lastSupplierName: null,
    lastPurchaseQty: null,
    ...partial,
  };
}

describe('Phase 18 purchase recommendations', () => {
  it('suggests ~2 weeks cover + safety from weekly velocity', () => {
    // 440 sold / 28 days => 110 / week
    // safety = ceil(110 * 0.75) = 83
    // target = ceil(110 * 2 + 83) = 303
    // available 35, open 0 => recommend 268
    const result = recommendPurchaseQty(
      signal({
        skuId: 'sku-1',
        status: 'low',
        availablePacks: 35,
        soldLast28Days: 440,
      }),
    );
    expect(result.include).toBe(true);
    expect(result.weeklyVelocity).toBe(110);
    expect(result.safetyStock).toBe(83);
    expect(result.targetStock).toBe(303);
    expect(result.recommendedQty).toBe(268);
    expect(result.reason).toMatch(/Low stock/i);
  });

  it('subtracts open draft purchases from the recommendation', () => {
    const result = recommendPurchaseQty(
      signal({
        skuId: 'sku-1',
        status: 'out_of_stock',
        availablePacks: 0,
        soldLast28Days: 40, // 10 / week
        openDraftQty: 30,
      }),
    );
    // safety = ceil(7.5)=8, target = ceil(20+8)=28, recommend = 28-0-30 = 0
    expect(result.include).toBe(false);
  });

  it('falls back to last purchase qty when out of stock with no sales', () => {
    const result = recommendPurchaseQty(
      signal({
        skuId: 'sku-2',
        status: 'out_of_stock',
        availablePacks: 0,
        soldLast28Days: 0,
        lastPurchaseQty: 50,
      }),
    );
    expect(result.include).toBe(true);
    expect(result.recommendedQty).toBe(50);
    expect(result.reason).toMatch(/last received/i);
  });

  it('skips healthy stock with enough cover', () => {
    const result = recommendPurchaseQty(
      signal({
        skuId: 'sku-3',
        status: 'healthy',
        availablePacks: 200,
        soldLast28Days: 40, // 10 / week
      }),
    );
    expect(result.include).toBe(false);
  });

  it('builds a ranked snapshot with honesty note and purchase links', () => {
    const snapshot = buildPurchaseRecommendationsSnapshot({
      generatedAtIso: '2026-10-02T12:00:00.000Z',
      signals: [
        signal({
          skuId: 'sku-out',
          productName: 'Cashew',
          status: 'out_of_stock',
          availablePacks: 0,
          soldLast28Days: 80,
          lastSupplierId: 'sup-1',
          lastSupplierName: 'Nut Co',
        }),
        signal({
          skuId: 'sku-ok',
          productName: 'Healthy Item',
          status: 'healthy',
          availablePacks: 500,
          soldLast28Days: 10,
        }),
      ],
    });

    expect(snapshot.honestyNote).toMatch(/not AI demand forecasting/i);
    expect(snapshot.recommendationCount).toBe(1);
    expect(snapshot.rows[0]?.skuId).toBe('sku-out');
    expect(snapshot.rows[0]?.purchaseHref).toContain('supplierId=sup-1');
    expect(snapshot.outOfStockCount).toBe(1);
  });
});
