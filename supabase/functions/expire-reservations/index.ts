import { assertCronAuthorized, jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { logEvent } from '../_shared/log.ts';
import { assertEdgeProviderConfig } from '../_shared/providers.ts';

/** Cron/worker: release expired stock reservations. Requires X-Cron-Secret. */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse(req);
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResponse(req, { error: 'Method not allowed' }, 405);
  }

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
  try {
    const { data, error } = await service.rpc('job_expire_stock_reservations');
    if (error) {
      await logEvent(service, {
        level: 'error',
        source: 'expire-reservations',
        message: error.message,
        rpcName: 'job_expire_stock_reservations',
        durationMs: Date.now() - started,
      });
      return jsonResponse(req, { error: error.message }, 500);
    }
    await logEvent(service, {
      level: 'info',
      source: 'expire-reservations',
      message: 'Reservations expired',
      context: data as Record<string, unknown>,
      rpcName: 'job_expire_stock_reservations',
      durationMs: Date.now() - started,
    });
    return jsonResponse(req, { ok: true, result: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await logEvent(service, {
      level: 'error',
      source: 'expire-reservations',
      message,
      durationMs: Date.now() - started,
    });
    return jsonResponse(req, { error: message }, 500);
  }
});
