import { describe, expect, it, vi } from 'vitest';
import type { GroAurumSupabaseClient } from '../../supabase/client';
import {
  createSupabaseSalesmanService,
  parseSalesmanEarnings,
  parseSalesmanTarget,
} from './salesman';

const ledgerEntry = {
  orderId: 'order-earned',
  orderNumber: 'ORDEREAR',
  shopName: 'Gupta Traders',
  earnedAt: '2026-09-12T08:00:00.000Z',
  orderStatus: 'DELIVERED',
  commissionAmount: 40,
};

const awaitingOrder = {
  orderId: 'order-wait',
  orderNumber: 'ORDERWAI',
  shopName: 'Sharma Stores',
  createdAt: '2026-09-20T08:00:00.000Z',
  orderStatus: 'CONFIRMED',
  orderTotal: 5000,
  commissionAmount: 999,
};

const earningsPayload = {
  month: '2026-09-01',
  earningModel: 'SALARY_PLUS_COMMISSION',
  earnedCommission: 40,
  salaryApplies: true,
  salary: { monthlySalary: 15000, dailyAllowance: 50, otherAllowance: 0 },
  totalEarnings: 15040,
  totalIncludesSalary: true,
  awaitingOrderCount: 1,
  awaitingOrderValue: 5000,
  awaitingOrders: [awaitingOrder],
  entries: [ledgerEntry],
  payslipsAvailable: false,
  target: {
    month: '2026-09-01',
    targetAmount: 4000,
    achievedAmount: 1200,
    remainingAmount: 2800,
    progressPercent: 30,
  },
};

describe('salesman earnings parsing', () => {
  it('reads commission from the ledger and does not keep an estimated amount', () => {
    const earnings = parseSalesmanEarnings(earningsPayload);
    expect(earnings.earnedCommission).toBe(40);
    expect(earnings.entries).toEqual([ledgerEntry]);
    expect(earnings.awaitingOrders[0]).toEqual({
      orderId: 'order-wait',
      orderNumber: 'ORDERWAI',
      shopName: 'Sharma Stores',
      createdAt: '2026-09-20T08:00:00.000Z',
      orderStatus: 'CONFIRMED',
      orderTotal: 5000,
    });
    expect(earnings.awaitingOrders[0]).not.toHaveProperty('commissionAmount');
    expect(earnings.payslipsAvailable).toBe(false);
    expect(earnings.salary?.monthlySalary).toBe(15000);
    expect(earnings.totalEarnings).toBe(15040);
  });

  it('returns null when there is no target', () => {
    expect(parseSalesmanTarget(null)).toBeNull();
    expect(parseSalesmanEarnings({ ...earningsPayload, target: null }).target).toBeNull();
  });

  it('getEarnings uses the earnings RPC and surfaces errors', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'salesman_earnings_month') {
        return { data: earningsPayload, error: null };
      }
      return { data: null, error: { message: 'unexpected' } };
    });
    const api = createSupabaseSalesmanService({ rpc } as unknown as GroAurumSupabaseClient);
    const earnings = await api.getEarnings();
    expect(rpc).toHaveBeenCalledWith('salesman_earnings_month', { p_month: null });
    expect(earnings.entries[0]?.commissionAmount).toBe(40);

    const failing = vi.fn(async () => ({ data: null, error: { message: 'permission denied' } }));
    const broken = createSupabaseSalesmanService({
      rpc: failing,
    } as unknown as GroAurumSupabaseClient);
    await expect(broken.getMonthTarget()).rejects.toEqual({ message: 'permission denied' });
  });
});
