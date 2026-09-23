import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { logEvent } from '../_shared/log.ts';

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(body),
  );
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Razorpay webhook — HMAC is REQUIRED (Sprint 9.1).
 * Unsigned or invalid signatures are rejected.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse(req);
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);

  const started = Date.now();
  const service = createServiceClient();
  const rawBody = await req.text();

  try {
    const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
    if (!secret || !secret.trim()) {
      await logEvent(service, {
        level: 'error',
        source: 'razorpay-webhook',
        message: 'RAZORPAY_WEBHOOK_SECRET not configured — rejecting',
        durationMs: Date.now() - started,
      });
      return jsonResponse(req, { error: 'Webhook secret not configured' }, 503);
    }

    const signature = req.headers.get('x-razorpay-signature') ?? '';
    if (!signature) {
      await logEvent(service, {
        level: 'error',
        source: 'razorpay-webhook',
        message: 'Missing X-Razorpay-Signature',
        durationMs: Date.now() - started,
      });
      return jsonResponse(req, { error: 'Missing signature' }, 401);
    }

    const expected = await hmacSha256Hex(secret, rawBody);
    if (expected !== signature) {
      await logEvent(service, {
        level: 'error',
        source: 'razorpay-webhook',
        message: 'Invalid webhook signature',
        durationMs: Date.now() - started,
      });
      return jsonResponse(req, { error: 'Invalid signature' }, 401);
    }

    const event = JSON.parse(rawBody) as {
      event?: string;
      id?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            status?: string;
            amount?: number;
          };
        };
        order?: { entity?: { id?: string; status?: string; amount?: number } };
      };
    };

    const eventId = String(event.id ?? `${event.event ?? 'evt'}_${Date.now()}`);
    const paymentEntity = event.payload?.payment?.entity;
    const orderEntity = event.payload?.order?.entity;
    const providerReference = String(
      paymentEntity?.order_id ?? orderEntity?.id ?? '',
    );
    const statusRaw = String(
      paymentEntity?.status ?? orderEntity?.status ?? event.event ?? '',
    );
    const amountPaise = paymentEntity?.amount ?? orderEntity?.amount;
    const amount =
      typeof amountPaise === 'number' ? amountPaise / 100 : null;

    if (!providerReference) {
      return jsonResponse(req, { error: 'Missing provider order reference' }, 400);
    }

    let mappedStatus = 'failed';
    if (
      statusRaw.includes('captured') ||
      statusRaw.includes('paid') ||
      statusRaw === 'payment.captured' ||
      statusRaw === 'order.paid'
    ) {
      mappedStatus = 'paid';
    } else if (
      statusRaw.includes('failed') ||
      statusRaw.includes('cancelled') ||
      statusRaw === 'payment.failed'
    ) {
      mappedStatus = 'failed';
    }

    const { data: paymentId, error } = await service.rpc(
      'apply_payment_webhook_event',
      {
        p_provider: 'razorpay',
        p_provider_event_id: eventId,
        p_provider_reference: providerReference,
        p_status: mappedStatus,
        p_amount: amount,
        p_raw: event,
      },
    );

    if (error) {
      await logEvent(service, {
        level: 'error',
        source: 'razorpay-webhook',
        message: error.message,
        context: { providerReference, eventId },
        rpcName: 'apply_payment_webhook_event',
        durationMs: Date.now() - started,
      });
      return jsonResponse(req, { error: error.message }, 400);
    }

    await logEvent(service, {
      level: 'info',
      source: 'razorpay-webhook',
      message: 'Webhook applied',
      context: { paymentId, providerReference, mappedStatus, eventId },
      rpcName: 'apply_payment_webhook_event',
      durationMs: Date.now() - started,
    });

    return jsonResponse(req, { ok: true, paymentId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await logEvent(service, {
      level: 'error',
      source: 'razorpay-webhook',
      message,
      durationMs: Date.now() - started,
    });
    return jsonResponse(req, { error: message }, 500);
  }
});
