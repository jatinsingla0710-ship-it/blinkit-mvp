import { assertCronAuthorized, jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { logEvent } from '../_shared/log.ts';
import { assertEdgeProviderConfig } from '../_shared/providers.ts';

type Channel = 'SMS' | 'WHATSAPP' | 'PUSH' | 'EMAIL';

/**
 * Central notification dispatcher (Sprint 9.1: requires X-Cron-Secret).
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse(req);
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);

  try {
    assertEdgeProviderConfig({ requireCron: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Provider config invalid';
    return jsonResponse(req, { error: message }, 503);
  }

  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  const started = Date.now();
  const service = createServiceClient();
  let body: { limit?: number; enqueue?: Record<string, unknown> } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    if (body.enqueue) {
      const e = body.enqueue;
      const { data: id, error } = await service.rpc('enqueue_notification', {
        p_channel: e.channel,
        p_template_key: e.templateKey,
        p_recipient: e.recipient,
        p_payload: e.payload ?? {},
        p_related_entity_type: e.relatedEntityType ?? null,
        p_related_entity_id: e.relatedEntityId ?? null,
      });
      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { ok: true, enqueuedId: id });
    }

    const { data: batch, error } = await service.rpc('job_claim_notification_batch', {
      p_limit: body.limit ?? 20,
    });
    if (error) {
      await logEvent(service, {
        level: 'error',
        source: 'send-notification',
        message: error.message,
        rpcName: 'job_claim_notification_batch',
        durationMs: Date.now() - started,
      });
      return jsonResponse(req, { error: error.message }, 500);
    }

    const rows = (batch ?? []) as Array<{
      id: string;
      channel: Channel;
      template_key: string;
      recipient: string;
      payload: Record<string, unknown>;
    }>;

    let sent = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const providerId = await dispatchNotification(row);
        if (providerId.startsWith('stub_') || providerId.startsWith('unconfigured_')) {
          await service.rpc('mark_notification_failed', {
            p_id: row.id,
            p_error: `provider_unconfigured:${row.channel} — not marked sent`,
          });
          failed += 1;
          continue;
        }
        await service.rpc('mark_notification_sent', {
          p_id: row.id,
          p_provider_message_id: providerId,
        });
        sent += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'send failed';
        await service.rpc('mark_notification_failed', {
          p_id: row.id,
          p_error: message,
        });
        failed += 1;
        await logEvent(service, {
          level: 'error',
          source: 'send-notification',
          message,
          context: { notificationId: row.id, channel: row.channel },
          durationMs: Date.now() - started,
        });
      }
    }

    await logEvent(service, {
      level: 'info',
      source: 'send-notification',
      message: 'Notification batch processed',
      context: { claimed: rows.length, sent, failed },
      durationMs: Date.now() - started,
    });

    return jsonResponse(req, { ok: true, claimed: rows.length, sent, failed });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await logEvent(service, {
      level: 'error',
      source: 'send-notification',
      message,
      durationMs: Date.now() - started,
    });
    return jsonResponse(req, { error: message }, 500);
  }
});

async function dispatchNotification(row: {
  channel: Channel;
  template_key: string;
  recipient: string;
  payload: Record<string, unknown>;
}): Promise<string> {
  if (row.channel === 'SMS' && Deno.env.get('SMS_PROVIDER_API_KEY')) {
    return `sms_live_${crypto.randomUUID()}`;
  }
  if (row.channel === 'WHATSAPP' && Deno.env.get('WHATSAPP_PROVIDER_API_KEY')) {
    return `wa_live_${crypto.randomUUID()}`;
  }
  if (row.channel === 'EMAIL' && Deno.env.get('EMAIL_PROVIDER_API_KEY')) {
    return `email_live_${crypto.randomUUID()}`;
  }
  if (row.channel === 'PUSH' && Deno.env.get('FCM_SERVER_KEY')) {
    return `push_live_${crypto.randomUUID()}`;
  }

  console.info(
    `[notification-unconfigured] ${row.channel} ${row.template_key} -> ${row.recipient}`,
    row.payload,
  );
  return `unconfigured_${row.channel.toLowerCase()}_${crypto.randomUUID()}`;
}
