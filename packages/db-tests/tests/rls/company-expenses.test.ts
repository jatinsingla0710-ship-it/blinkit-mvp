import { describe, expect, it } from 'vitest';
import { createAuthUser } from '../../src/fixtures';
import { withUserClient } from '../../src/client';

describe('RLS: company_expenses', () => {
  it('lets admin create, read, update, and delete company expenses', async () => {
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `96100${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });

    await withUserClient(admin.accessToken, async (client) => {
      const { data: created, error: createError } = await client.rpc(
        'admin_create_company_expense',
        {
          p_expense_date: '2026-09-30',
          p_category: 'TRANSPORT',
          p_amount: 800,
          p_description: 'Fuel for van',
          p_payment_method: 'CASH',
        },
      );
      expect(createError).toBeNull();
      const expenseId = (created as { id?: string } | null)?.id;
      expect(expenseId).toBeTruthy();

      const { data: listed, error: listError } = await client
        .from('company_expenses')
        .select('id, amount, description')
        .eq('id', expenseId!)
        .single();
      expect(listError).toBeNull();
      expect(listed?.description).toBe('Fuel for van');

      const { error: updateError } = await client.rpc(
        'admin_update_company_expense',
        {
          p_expense_id: expenseId!,
          p_expense_date: '2026-09-30',
          p_category: 'TRANSPORT',
          p_amount: 900,
          p_description: 'Fuel topped up',
          p_payment_method: 'UPI',
        },
      );
      expect(updateError).toBeNull();

      const { error: deleteError } = await client.rpc(
        'admin_delete_company_expense',
        { p_expense_id: expenseId! },
      );
      expect(deleteError).toBeNull();
    });
  });

  it('blocks salesman from company expenses', async () => {
    const salesman = await createAuthUser({
      roles: ['SALESMAN'],
      mobile: `96200${Math.floor(Math.random() * 1e5)
        .toString()
        .padStart(5, '0')}`,
    });

    await withUserClient(salesman.accessToken, async (client) => {
      const { data, error } = await client
        .from('company_expenses')
        .select('id')
        .limit(1);
      expect(error).toBeNull();
      expect(data ?? []).toEqual([]);

      const { error: createError } = await client.rpc(
        'admin_create_company_expense',
        {
          p_expense_date: '2026-09-30',
          p_category: 'OTHER',
          p_amount: 10,
          p_description: 'Should fail',
          p_payment_method: 'CASH',
        },
      );
      expect(createError).toBeTruthy();
    });
  });
});
