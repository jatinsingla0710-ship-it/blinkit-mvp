import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { createServiceClient, createUserClient } from '../_shared/supabase.ts';
import { logEvent } from '../_shared/log.ts';
import { assertEdgeProviderConfig } from '../_shared/providers.ts';

/**
 * Razorpay order create — prepares online payment intent.
 * Requires caller JWT (gateway verify_jwt=true). Secrets via env only.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse(req);
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);

  try {
    assertEdgeProviderConfig({ requireRazorpay: true, requireCron: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Provider config invalid';
    return jsonResponse(req, { error: message }, 503);
  }

  const started = Date.now();
  const service = createServiceClient();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse(req, { error: 'Authorization required' }, 401);
    }
    const userClient = createUserClient(authHeader);
    const body = await req.json();
    const orderId = String(body.orderId ?? '');
    const amount = Number(body.amount);
    const currency = String(body.currency ?? 'INR').toUpperCase();

    if (!orderId || !Number.isFinite(amount) || amount <= 0) {
      return jsonResponse(req, { error: 'orderId and positive amount required' }, 400);
    }

    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    let providerReference: string;
    let stubMode = false;

    if (keyId && keySecret) {
      const amountPaise = Math.round(amount * 100);
      const auth = btoa(`${keyId}:${keySecret}`);
      const rzRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency,
          receipt: orderId.slice(0, 40),
          notes: { groaurum_order_id: orderId },
        }),
      });
      if (!rzRes.ok) {
        const errText = await rzRes.text();
        await logEvent(service, {
          level: 'error',
          source: 'razorpay-create-order',
          message: 'Razorpay order create failed',
          context: { status: rzRes.status, errText },
          rpcName: 'create_online_payment_intent',
          durationMs: Date.now() - started,
        });
        return jsonResponse(req, { error: 'Razorpay create failed', detail: errText }, 502);
      }
      const rz = await rzRes.json();
      providerReference = String(rz.id);
    } else if ((Deno.env.get('APP_ENV') ?? 'development') === 'development') {
      stubMode = true;
      providerReference = `order_stub_${orderId.replace(/-/g, '').slice(0, 14)}`;
    } else {
      await logEvent(service, {
        level: 'error',
        source: 'razorpay-create-order',
        message: 'RAZORPAY_KEY_ID/SECRET missing in non-development',
        durationMs: Date.now() - started,
      });
      return jsonResponse(req, { error: 'Razorpay is not configured' }, 503);
    }

    const { data: paymentId, error } = await userClient.rpc(
      'create_online_payment_intent',
      {
        p_order_id: orderId,
        p_amount: amount,
        p_currency: currency,
        p_provider_reference: providerReference,
      },
    );

    if (error) {
      await logEvent(service, {
        level: 'error',
        source: 'razorpay-create-order',
        message: error.message,
        context: { orderId },
        rpcName: 'create_online_payment_intent',
        durationMs: Date.now() - started,
      });
      return jsonResponse(req, { error: error.message }, 400);
    }

    await logEvent(service, {
      level: 'info',
      source: 'razorpay-create-order',
      message: 'Payment intent created',
      context: { orderId, paymentId, providerReference, stubMode },
      rpcName: 'create_online_payment_intent',
      durationMs: Date.now() - started,
    });

    return jsonResponse(req, {
      ok: true,
      paymentId,
      razorpayOrderId: providerReference,
      keyId: stubMode ? null : keyId,
      stubMode,
      amount,
      currency,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await logEvent(service, {
      level: 'error',
      source: 'razorpay-create-order',
      message,
      durationMs: Date.now() - started,
    });
    return jsonResponse(req, { error: message }, 500);
  }
});
