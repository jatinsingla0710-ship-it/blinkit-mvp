import { describe, expect, it } from 'vitest';
import {
  applyWacIssue,
  applyWacReceipt,
  formatWacUnitCost,
} from './inventory-valuation';

describe('Phase 4 inventory WAC valuation', () => {
  it('matches the master-plan weighted average example', () => {
    const afterFirst = applyWacReceipt(
      { onHandQuantity: 0, averageUnitCost: null, stockValue: 0 },
      100,
      100,
    );
    expect(afterFirst).toMatchObject({
      onHandQuantity: 100,
      averageUnitCost: 100,
      stockValue: 10000,
    });

    const afterSecond = applyWacReceipt(afterFirst, 50, 120);
    expect(afterSecond.onHandQuantity).toBe(150);
    expect(afterSecond.stockValue).toBe(16000);
    expect(afterSecond.averageUnitCost).toBeCloseTo(106.6667, 4);
  });

  it('issues stock at average without changing the average', () => {
    const stock = {
      onHandQuantity: 150,
      averageUnitCost: 106.6667,
      stockValue: 16000,
    };
    const afterIssue = applyWacIssue(stock, 50);
    expect(afterIssue.onHandQuantity).toBe(100);
    expect(afterIssue.averageUnitCost).toBe(106.6667);
    expect(afterIssue.stockValue).toBe(10666.67);
    expect(afterIssue.unitCostApplied).toBe(106.6667);
  });

  it('clears average when on-hand reaches zero', () => {
    const after = applyWacIssue(
      { onHandQuantity: 10, averageUnitCost: 50, stockValue: 500 },
      10,
    );
    expect(after).toEqual({
      onHandQuantity: 0,
      averageUnitCost: null,
      stockValue: 0,
      unitCostApplied: 50,
    });
  });

  it('formats missing unit cost as an em dash', () => {
    expect(formatWacUnitCost(null)).toBe('—');
    expect(formatWacUnitCost(106.6667)).toContain('106');
  });
});
