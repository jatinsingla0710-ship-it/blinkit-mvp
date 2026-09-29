import { describe, expect, it, vi } from 'vitest';
import type { GroAurumSupabaseClient } from '../../supabase/client';
import {
  createSupabaseSalesmanService,
  expenseReceiptObjectPath,
  returnPhotoObjectPath,
} from './salesman';

const expenseRow = {
  id: 'exp-1',
  salesman_profile_id: 'profile-1',
  category: 'FOOD',
  amount: 80,
  expense_date: '2026-09-20',
  note: 'Lunch',
  receipt_path: 'profile-1/expenses/exp-1',
  status: 'PENDING',
  review_note: null,
  reviewed_at: null,
  created_at: '2026-09-20T08:00:00.000Z',
};

describe('salesman expense and return adapter', () => {
  it('builds private media paths under the salesman folder', () => {
    expect(expenseReceiptObjectPath('profile-1', 'exp-1')).toBe('profile-1/expenses/exp-1');
    expect(returnPhotoObjectPath('profile-1', 'ret-1')).toBe('profile-1/returns/ret-1');
  });

  it('lists own expenses and signs the receipt', async () => {
    const client = {
      from: vi.fn(() => ({
        select: () => ({
          order: async () => ({ data: [expenseRow], error: null }),
        }),
      })),
      storage: {
        from: () => ({
          createSignedUrl: async () => ({
            data: { signedUrl: 'https://example.test/receipt' },
            error: null,
          }),
        }),
      },
    } as unknown as GroAurumSupabaseClient;

    const rows = await createSupabaseSalesmanService(client).listExpenses();
    expect(rows).toEqual([
      expect.objectContaining({
        id: 'exp-1',
        category: 'FOOD',
        amount: 80,
        status: 'PENDING',
        receiptUrl: 'https://example.test/receipt',
      }),
    ]);
  });

  it('createExpense sends the RPC and throws the database error', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'Enter an amount greater than zero' } }));
    const client = { rpc } as unknown as GroAurumSupabaseClient;
    await expect(
      createSupabaseSalesmanService(client).createExpense({
        category: 'TRAVEL',
        amount: 0,
        expenseDate: '2026-09-20',
      }),
    ).rejects.toMatchObject({ message: 'Enter an amount greater than zero' });
    expect(rpc).toHaveBeenCalledWith('salesman_create_expense', {
      p_category: 'TRAVEL',
      p_amount: 0,
      p_expense_date: '2026-09-20',
      p_note: null,
    });
  });

  it('createReturnRequest returns the pending request', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        id: 'ret-1',
        salesmanProfileId: 'profile-1',
        shopId: 'shop-1',
        shopName: 'Sharma Stores',
        orderId: 'order-1',
        skuId: 'sku-1',
        productName: 'Almonds',
        skuName: 'Almond 1kg',
        skuCode: 'ALM-1KG',
        quantity: 1,
        reason: 'Damaged',
        note: null,
        photoPath: null,
        status: 'PENDING',
        reviewNote: null,
        reviewedAt: null,
        createdAt: '2026-09-20T08:00:00.000Z',
      },
      error: null,
    }));
    const client = { rpc } as unknown as GroAurumSupabaseClient;
    const created = await createSupabaseSalesmanService(client).createReturnRequest({
      orderId: 'order-1',
      skuId: 'sku-1',
      quantity: 1,
      reason: 'Damaged',
    });
    expect(created.status).toBe('PENDING');
    expect(created.shopName).toBe('Sharma Stores');
    expect(rpc).toHaveBeenCalledWith(
      'salesman_create_return_request',
      expect.objectContaining({ p_quantity: 1, p_reason: 'Damaged' }),
    );
  });
});
