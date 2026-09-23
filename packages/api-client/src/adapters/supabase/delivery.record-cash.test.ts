import { describe, expect, it, vi } from 'vitest';
import {
  createSupabaseDeliveryService,
  invokeDeliveryRecordCashPayment,
  parseRecordCashPaymentRpcResult,
} from './delivery';
import type { GroAurumSupabaseClient } from '../../supabase/client';

describe('parseRecordCashPaymentRpcResult', () => {
  it('maps RPC jsonb fields for UI', () => {
    expect(
      parseRecordCashPaymentRpcResult({
        amountDue: 10000,
        cashCollected: 4000,
        onlineCollected: 0,
        remaining: 6000,
        paymentStatus: 'PAYMENT_PENDING',
        canCompleteDelivery: false,
        onlineProviderConfigured: false,
        onlineAction: 'NOT_CONFIGURED',
      }),
    ).toEqual({
      amountDue: 10000,
      cashCollected: 4000,
      onlineCollected: 0,
      remaining: 6000,
      paymentStatus: 'PAYMENT_PENDING',
      canCompleteDelivery: false,
      onlineProviderConfigured: false,
      onlineAction: 'NOT_CONFIGURED',
    });
  });
});

describe('createSupabaseDeliveryService.recordCashPayment', () => {
  it('exists and calls delivery_record_cash_payment RPC only', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        amountDue: 10000,
        cashCollected: 4000,
        onlineCollected: 0,
        remaining: 6000,
        paymentStatus: 'PAYMENT_PENDING',
        canCompleteDelivery: false,
        onlineProviderConfigured: false,
        onlineAction: 'NOT_CONFIGURED',
      },
      error: null,
    });
    const from = vi.fn(() => {
      throw new Error('browser must not CRUD payments/custody tables');
    });
    const client = { rpc, from } as unknown as GroAurumSupabaseClient;
    const service = createSupabaseDeliveryService(client);

    expect(typeof service.recordCashPayment).toBe('function');

    const result = await service.recordCashPayment({
      orderId: 'order-1',
      cashAmount: 4000,
    });

    expect(rpc).toHaveBeenCalledWith('delivery_record_cash_payment', {
      p_order_id: 'order-1',
      p_cash_amount: 4000,
    });
    expect(from).not.toHaveBeenCalled();
    expect(result.remaining).toBe(6000);
    expect(result.paymentStatus).toBe('PAYMENT_PENDING');
    expect(result.canCompleteDelivery).toBe(false);
  });

  it('₹10,000 + ₹10,000 cash → remaining 0 via RPC payload', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        amountDue: 10000,
        cashCollected: 10000,
        onlineCollected: 0,
        remaining: 0,
        paymentStatus: 'PAID',
        canCompleteDelivery: true,
        onlineProviderConfigured: false,
        onlineAction: 'NOT_REQUIRED',
      },
      error: null,
    });
    const client = {
      rpc,
      from: vi.fn(),
    } as unknown as GroAurumSupabaseClient;
    const service = createSupabaseDeliveryService(client);
    const result = await service.recordCashPayment({
      orderId: 'order-2',
      cashAmount: 10000,
    });
    expect(result.remaining).toBe(0);
    expect(result.canCompleteDelivery).toBe(true);
    expect(result.paymentStatus).toBe('PAID');
  });

  it('propagates RPC errors (no fake success)', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Cash cannot exceed amount due' },
    });
    const client = { rpc, from: vi.fn() } as unknown as GroAurumSupabaseClient;
    await expect(
      invokeDeliveryRecordCashPayment(client, {
        orderId: 'order-3',
        cashAmount: 11000,
      }),
    ).rejects.toMatchObject({ message: 'Cash cannot exceed amount due' });
  });

  it('partial cash does not invent online paid / full PAID', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        amountDue: 10000,
        cashCollected: 4000,
        onlineCollected: 0,
        remaining: 6000,
        paymentStatus: 'PAYMENT_PENDING',
        canCompleteDelivery: false,
        onlineProviderConfigured: false,
        onlineAction: 'NOT_CONFIGURED',
      },
      error: null,
    });
    const client = { rpc, from: vi.fn() } as unknown as GroAurumSupabaseClient;
    const result = await invokeDeliveryRecordCashPayment(client, {
      orderId: 'order-4',
      cashAmount: 4000,
    });
    expect(result.onlineCollected).toBe(0);
    expect(result.paymentStatus).not.toBe('PAID');
    expect(result.canCompleteDelivery).toBe(false);
  });
});
