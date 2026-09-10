const ALLOWED_ORIGINS = new Set(['https://l33kr.github.io']);
const WARP_API = 'https://api.cloudflareclient.com/v0a737/reg';

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...cors(origin)
    }
  });
}

function isWireGuardPublicKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(value)) return false;
  try {
    return Uint8Array.from(atob(value), c => c.charCodeAt(0)).length === 32;
  } catch {
    return false;
  }
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (!ALLOWED_ORIGINS.has(origin)) return new Response('Forbidden', { status: 403 });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true }, 200, origin);
    if (request.method !== 'POST' || url.pathname !== '/register') return json({ error: 'Not found' }, 404, origin);

    let input;
    try { input = await request.json(); }
    catch { return json({ error: 'Invalid JSON' }, 400, origin); }

    if (!isWireGuardPublicKey(input?.key)) return json({ error: 'Invalid WireGuard public key' }, 400, origin);

    const payload = {
      key: input.key,
      install_id: '',
      warp_enabled: true,
      tos: new Date().toISOString(),
      type: typeof input.type === 'string' ? input.type.slice(0, 32) : 'Android',
      locale: typeof input.locale === 'string' ? input.locale.slice(0, 16) : 'en_US'
    };

    let upstream;
    try {
      upstream = await fetch(WARP_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      return json({ error: `Cloudflare WARP API network error: ${e?.message || 'unknown error'}` }, 502, origin);
    }

    let data;
    try { data = await upstream.json(); }
    catch { return json({ error: `Cloudflare WARP API returned HTTP ${upstream.status}` }, 502, origin); }

    const peer = data?.config?.peers?.[0];
    const addresses = data?.config?.interface?.addresses;
    if (!upstream.ok || !peer?.public_key || !addresses?.v4) {
      const reason = data?.errors?.[0]?.message || data?.message || `HTTP ${upstream.status}`;
      return json({ error: `WARP registration failed: ${reason}` }, 502, origin);
    }

    return json({
      ipv4: addresses.v4,
      ipv6: addresses.v6 || null,
      peerPublicKey: peer.public_key,
      deviceId: data.id || null,
      warpPlus: Boolean(data?.account?.warp_plus)
    }, 200, origin);
  }
};
