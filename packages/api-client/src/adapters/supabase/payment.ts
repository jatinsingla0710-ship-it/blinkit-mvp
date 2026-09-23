import type {
  Payment,
  PaymentMethodIntent,
  PaymentStatus,
} from '@groaurum/shared-types';
import type {
  PaymentService,
  RecordPaymentInput,
  ServiceActionResult,
} from '../../contracts';
import type { GroAurumSupabaseClient } from '../../supabase/client';

type PaymentRow = {
  id: string;
  order_id: string;
  status: string;
  method_intent: string;
  collection_method: string | null;
  amount: number | string;
  currency: string;
  provider_reference: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    orderId: row.order_id,
    status: row.status as PaymentStatus,
    methodIntent: row.method_intent as PaymentMethodIntent,
    amount: Number(row.amount),
    currency: row.currency,
    providerReference: row.provider_reference ?? undefined,
    paidAt: row.paid_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function ok<T>(data: T): ServiceActionResult<T> {
  return { ok: true, data };
}

function fail<T = void>(error: string): ServiceActionResult<T> {
  return { ok: false, error };
}

/**
 * Online + COD payment facade.
 * - createPaymentIntent: RPC create_online_payment_intent (Razorpay edge wraps this)
 * - mark paid/failed: typically via webhook apply_payment_webhook_event (service role)
 */
export function createSupabasePaymentService(
  client: GroAurumSupabaseClient,
): PaymentService {
  return {
    async getPaymentByOrderId(orderId: string): Promise<Payment | null> {
      const { data, error } = await client
        .from('payments')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();
      if (error) throw error;
      return data ? mapPayment(data as PaymentRow) : null;
    },

    async createPaymentIntent(
      input: RecordPaymentInput,
    ): Promise<ServiceActionResult<Payment>> {
      if (input.methodIntent !== 'PAY_ONLINE_NOW') {
        return fail('createPaymentIntent is for PAY_ONLINE_NOW; use COD collect for delivery');
      }
      const { data: paymentId, error } = await client.rpc(
        'create_online_payment_intent',
        {
          p_order_id: input.orderId,
          p_amount: input.amount,
          p_currency: input.currency,
          p_provider_reference: input.providerReference ?? null,
        },
      );
      if (error) return fail(error.message);
      const { data, error: readErr } = await client
        .from('payments')
        .select('*')
        .eq('id', paymentId as string)
        .single();
      if (readErr) return fail(readErr.message);
      return ok(mapPayment(data as PaymentRow));
    },

    async recordPayment(
      input: RecordPaymentInput,
    ): Promise<ServiceActionResult<Payment>> {
      return this.createPaymentIntent(input);
    },

    async markPaymentPending(
      paymentId: string,
    ): Promise<ServiceActionResult<Payment>> {
      return fail(
        `markPaymentPending(${paymentId}): use create_online_payment_intent / Razorpay edge function`,
      );
    },

    async markPaymentPaid(
      paymentId: string,
      _providerReference?: string,
    ): Promise<ServiceActionResult<Payment>> {
      return fail(
        `markPaymentPaid(${paymentId}): online payments must be confirmed via razorpay-webhook`,
      );
    },

    async markPaymentFailed(
      paymentId: string,
      _reason?: string,
    ): Promise<ServiceActionResult<Payment>> {
      return fail(
        `markPaymentFailed(${paymentId}): online failures must be confirmed via razorpay-webhook`,
      );
    },

    async markPaymentRefunded(
      paymentId: string,
      _reason?: string,
    ): Promise<ServiceActionResult<Payment>> {
      return fail(
        `markPaymentRefunded(${paymentId}): refunds require trusted admin/service workflow (not client)`,
      );
    },

    async getPaymentStatus(paymentId: string): Promise<PaymentStatus | null> {
      const { data, error } = await client
        .from('payments')
        .select('status')
        .eq('id', paymentId)
        .maybeSingle();
      if (error) throw error;
      return data ? (data.status as PaymentStatus) : null;
    },
  };
}
