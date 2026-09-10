const WARP_API = "https://api.cloudflareclient.com/v0a737/reg";

const ASSETS: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/index.html": { file: "index.html", type: "text/html; charset=utf-8" },
  "/style.css": { file: "style.css", type: "text/css; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/wireguard.js": { file: "wireguard.js", type: "text/javascript; charset=utf-8" },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function validPublicKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]{43}=$/.test(value)) return false;
  try {
    return Uint8Array.from(atob(value), (c) => c.charCodeAt(0)).length === 32;
  } catch {
    return false;
  }
}

async function registerWarp(req: Request): Promise<Response> {
  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > 4096) return json({ error: "Request too large" }, 413);

  let input: Record<string, unknown>;
  try {
    input = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!validPublicKey(input.key)) {
    return json({ error: "Invalid WireGuard public key" }, 400);
  }

  const payload = {
    key: input.key,
    install_id: "",
    warp_enabled: true,
    tos: new Date().toISOString(),
    type: typeof input.type === "string" ? input.type.slice(0, 32) : "Android",
    locale: typeof input.locale === "string" ? input.locale.slice(0, 16) : "en_US",
  };

  let upstream: Response;
  try {
    upstream = await fetch(WARP_API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "network error";
    return json({ error: `WARP API network error: ${message}` }, 502);
  }

  let data: any;
  try {
    data = await upstream.json();
  } catch {
    return json({ error: `WARP API returned HTTP ${upstream.status}` }, 502);
  }

  const peer = data?.config?.peers?.[0];
  const addresses = data?.config?.interface?.addresses;
  if (!upstream.ok || !peer?.public_key || !addresses?.v4) {
    const reason = data?.errors?.[0]?.message || data?.message || `HTTP ${upstream.status}`;
    return json({ error: `WARP registration failed: ${reason}` }, 502);
  }

  return json({
    ipv4: addresses.v4,
    ipv6: addresses.v6 || null,
    peerPublicKey: peer.public_key,
    deviceId: data.id || null,
    warpPlus: Boolean(data?.account?.warp_plus),
  });
}

async function serveAsset(pathname: string): Promise<Response> {
  const asset = ASSETS[pathname];
  if (!asset) return new Response("Not found", { status: 404 });
  try {
    const bytes = await Deno.readFile(new URL(`./${asset.file}`, import.meta.url));
    return new Response(bytes, {
      headers: {
        "content-type": asset.type,
        "cache-control": pathname === "/" || pathname === "/index.html" ? "no-cache" : "public, max-age=300",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Asset not found", { status: 404 });
  }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname === "/api/health") {
    return json({ ok: true, runtime: "deno-deploy" });
  }

  if (req.method === "POST" && url.pathname === "/api/register") {
    return await registerWarp(req);
  }

  if (req.method === "GET" || req.method === "HEAD") {
    const response = await serveAsset(url.pathname);
    if (req.method === "HEAD") return new Response(null, { status: response.status, headers: response.headers });
    return response;
  }

  return new Response("Method not allowed", { status: 405 });
});
