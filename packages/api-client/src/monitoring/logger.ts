/**
 * Lightweight application logger — writes to application_logs via RPC when a
 * Supabase client is provided; always mirrors to console.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'perf';

export type LogRpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ error: { message: string } | null }>;
};

export type AppLogger = {
  debug: (message: string, context?: Record<string, unknown>) => void;
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
  perf: (
    message: string,
    durationMs: number,
    context?: Record<string, unknown>,
  ) => void;
  rpcFailure: (
    rpcName: string,
    message: string,
    context?: Record<string, unknown>,
  ) => void;
};

export function createAppLogger(options: {
  source: string;
  client?: LogRpcClient | null;
}): AppLogger {
  const { source, client } = options;

  function emit(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    rpcName?: string,
    durationMs?: number,
  ) {
    const payload = { source, level, message, context, rpcName, durationMs };
    if (level === 'error') console.error('[groaurum]', payload);
    else if (level === 'warn') console.warn('[groaurum]', payload);
    else console.info('[groaurum]', payload);

    if (client) {
      void Promise.resolve(
        client.rpc('log_application_event', {
          p_level: level,
          p_source: source,
          p_message: message,
          p_context: context ?? null,
          p_rpc_name: rpcName ?? null,
          p_duration_ms: durationMs ?? null,
        }),
      ).catch(() => undefined);
    }
  }

  return {
    debug: (message, context) => emit('debug', message, context),
    info: (message, context) => emit('info', message, context),
    warn: (message, context) => emit('warn', message, context),
    error: (message, context) => emit('error', message, context),
    perf: (message, durationMs, context) =>
      emit('perf', message, context, undefined, durationMs),
    rpcFailure: (rpcName, message, context) =>
      emit('error', message, context, rpcName),
  };
}
