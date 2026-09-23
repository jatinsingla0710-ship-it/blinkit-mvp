// Shared CORS + auth helpers for GroAurum edge functions (Sprint 9.1).

function parseAllowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS') ?? Deno.env.get('CORS_ALLOWED_ORIGINS') ?? '';
  const listed = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (listed.length > 0) return listed;
  // Local defaults when unset
  return [
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://127.0.0.1:5174',
    'http://localhost:5174',
    'http://127.0.0.1:5175',
    'http://localhost:5175',
    'http://127.0.0.1:8081',
    'http://localhost:8081',
  ];
}

export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = parseAllowedOrigins();
  const match = allowed.includes(origin) ? origin : allowed[0] ?? '';
  return {
    'Access-Control-Allow-Origin': match,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-razorpay-signature, x-cron-secret',
    'Vary': 'Origin',
  };
}

export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' },
  });
}

export function optionsResponse(req: Request): Response {
  return new Response('ok', { headers: corsHeadersFor(req) });
}

/**
 * Protect background job edges. Requires X-Cron-Secret matching CRON_SECRET.
 * Webhooks should use their own signature checks instead.
 */
export function assertCronAuthorized(req: Request): Response | null {
  const expected = Deno.env.get('CRON_SECRET');
  if (!expected || !expected.trim()) {
    return new Response(
      JSON.stringify({
        error: 'CRON_SECRET is not configured — refusing job invocation',
      }),
      {
        status: 503,
        headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' },
      },
    );
  }
  const provided =
    req.headers.get('x-cron-secret') ??
    req.headers.get('X-Cron-Secret') ??
    '';
  if (provided !== expected) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' },
    });
  }
  return null;
}
