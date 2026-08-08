/**
 * Proxies browser → Kilo Gateway (avoids CORS on static hosts like GitHub Pages).
 *
 * Deploy:
 *   supabase functions deploy kilo-proxy --no-verify-jwt
 *
 * Client base URL:
 *   ${VITE_SUPABASE_URL}/functions/v1/kilo-proxy
 *   → POST .../kilo-proxy/chat/completions
 */

const KILO_UPSTREAM = 'https://api.kilo.ai/api/gateway';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-kilo-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.text();
    const kiloKey = req.headers.get('x-kilo-api-key');
    const upstreamHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (kiloKey) {
      upstreamHeaders.Authorization = `Bearer ${kiloKey}`;
    }

    const upstream = await fetch(`${KILO_UPSTREAM}/chat/completions`, {
      method: 'POST',
      headers: upstreamHeaders,
      body,
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        ...CORS,
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
