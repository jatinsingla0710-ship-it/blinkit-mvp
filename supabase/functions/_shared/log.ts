import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

export async function logEvent(
  client: SupabaseClient,
  input: {
    level: 'debug' | 'info' | 'warn' | 'error' | 'perf';
    source: string;
    message: string;
    context?: Record<string, unknown>;
    rpcName?: string;
    durationMs?: number;
  },
): Promise<void> {
  try {
    await client.rpc('log_application_event', {
      p_level: input.level,
      p_source: input.source,
      p_message: input.message,
      p_context: input.context ?? null,
      p_rpc_name: input.rpcName ?? null,
      p_duration_ms: input.durationMs ?? null,
    });
  } catch (err) {
    console.error('[logEvent] failed', err);
  }
}
