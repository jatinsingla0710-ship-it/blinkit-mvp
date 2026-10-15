import { describe, expect, it, vi } from 'vitest';
import { LiveAdminApi } from './LiveAdminApi';

describe('LiveAdminApi customer collection and opening balance RPCs', () => {
  function createRpcClient(
    rpcImpl: (fn: string, args: Record<string, unknown>) => Promise<{
      data: unknown;
      error: { message: string } | null;
    }>,
  ) {
    return {
      rpc: vi.fn(rpcImpl),
      from: vi.fn(),
    };
  }

  it('recordCustomerCollection calls admin_record_customer_collection with client request id', async () => {
    const client = createRpcClient(async () => ({
      data: {
        id: 'col-1',
        shop_id: 'shop-1',
        amount: 500,
        method: 'UPI',
        note: 'Partial',
        journal_entry_id: 'je-1',
        outstanding: 1500,
        idempotentReplay: false,
      },
      error: null,
    }));

    const api = new LiveAdminApi(client as never);
    const result = await api.recordCustomerCollection({
      shopId: 'shop-1',
      amount: 500,
      method: 'UPI',
      note: 'Partial',
      clientRequestId: 'req-abc-123',
    });

    expect(client.rpc).toHaveBeenCalledWith('admin_record_customer_collection', {
      p_shop_id: 'shop-1',
      p_amount: 500,
      p_method: 'UPI',
      p_note: 'Partial',
      p_client_request_id: 'req-abc-123',
    });
    expect(result).toMatchObject({
      id: 'col-1',
      shopId: 'shop-1',
      amount: 500,
      method: 'UPI',
      note: 'Partial',
      journalEntryId: 'je-1',
      outstanding: 1500,
      idempotentReplay: false,
    });
  });

  it('recordCustomerCollection passes null client request id when omitted', async () => {
    const client = createRpcClient(async () => ({
      data: {
        id: 'col-2',
        shopId: 'shop-1',
        amount: 100,
        method: 'CASH',
        note: null,
        journalEntryId: null,
        outstanding: 0,
        idempotentReplay: true,
      },
      error: null,
    }));

    const api = new LiveAdminApi(client as never);
    await api.recordCustomerCollection({
      shopId: 'shop-1',
      amount: 100,
      method: 'CASH',
    });

    expect(client.rpc).toHaveBeenCalledWith('admin_record_customer_collection', {
      p_shop_id: 'shop-1',
      p_amount: 100,
      p_method: 'CASH',
      p_note: null,
      p_client_request_id: null,
    });
  });

  it('recordCustomerCollection surfaces RPC failures', async () => {
    const client = createRpcClient(async () => ({
      data: null,
      error: { message: 'amount exceeds outstanding' },
    }));

    const api = new LiveAdminApi(client as never);
    await expect(
      api.recordCustomerCollection({
        shopId: 'shop-1',
        amount: 9999,
        method: 'UPI',
        clientRequestId: 'req-fail',
      }),
    ).rejects.toThrow('amount exceeds outstanding');
  });

  it('setShopOpeningBalance calls admin_set_shop_opening_balance with expected args', async () => {
    const client = createRpcClient(async () => ({
      data: {
        id: 'ob-1',
        shopId: 'shop-1',
        asOfDate: '2026-04-01',
        amount: 20000,
        note: 'Books start',
        journalEntryId: 'je-ob',
        outstanding: 20000,
        idempotentReplay: false,
      },
      error: null,
    }));

    const api = new LiveAdminApi(client as never);
    const result = await api.setShopOpeningBalance({
      shopId: 'shop-1',
      asOfDate: '2026-04-01',
      amount: 20000,
      note: 'Books start',
    });

    expect(client.rpc).toHaveBeenCalledWith('admin_set_shop_opening_balance', {
      p_shop_id: 'shop-1',
      p_as_of_date: '2026-04-01',
      p_amount: 20000,
      p_note: 'Books start',
    });
    expect(result).toMatchObject({
      id: 'ob-1',
      shopId: 'shop-1',
      asOfDate: '2026-04-01',
      amount: 20000,
      note: 'Books start',
      journalEntryId: 'je-ob',
      outstanding: 20000,
      idempotentReplay: false,
    });
  });

  it('setShopOpeningBalance surfaces RPC failures', async () => {
    const client = createRpcClient(async () => ({
      data: null,
      error: { message: 'permission denied for function' },
    }));

    const api = new LiveAdminApi(client as never);
    await expect(
      api.setShopOpeningBalance({
        shopId: 'shop-1',
        asOfDate: '2026-04-01',
        amount: 1000,
      }),
    ).rejects.toThrow('permission denied for function');
  });
});
