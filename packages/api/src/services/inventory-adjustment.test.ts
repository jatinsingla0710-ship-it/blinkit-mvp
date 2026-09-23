import { describe, expect, it } from 'vitest';
import { planInventoryAdjustment } from './inventory-adjustment';

describe('planInventoryAdjustment', () => {
  it('plans a positive adjustment', () => {
    expect(
      planInventoryAdjustment({
        currentOnHand: 100,
        reservedQuantity: 20,
        newOnHandQuantity: 150,
      }),
    ).toEqual({ ok: true, delta: 50, skipMovement: false });
  });

  it('plans a negative adjustment', () => {
    expect(
      planInventoryAdjustment({
        currentOnHand: 100,
        reservedQuantity: 20,
        newOnHandQuantity: 80,
      }),
    ).toEqual({ ok: true, delta: -20, skipMovement: false });
  });

  it('skips movement when delta is zero', () => {
    expect(
      planInventoryAdjustment({
        currentOnHand: 100,
        reservedQuantity: 20,
        newOnHandQuantity: 100,
      }),
    ).toEqual({ ok: true, delta: 0, skipMovement: true });
  });

  it('rejects on-hand below reserved stock', () => {
    expect(
      planInventoryAdjustment({
        currentOnHand: 100,
        reservedQuantity: 40,
        newOnHandQuantity: 30,
      }),
    ).toEqual({
      ok: false,
      error:
        'Cannot set on-hand (30) below reserved stock (40) for this warehouse',
    });
  });

  it('rejects negative on-hand', () => {
    expect(
      planInventoryAdjustment({
        currentOnHand: 10,
        reservedQuantity: 0,
        newOnHandQuantity: -1,
      }),
    ).toMatchObject({ ok: false });
  });
});
