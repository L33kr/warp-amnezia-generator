const WARP_API = "https://api.cloudflareclient.com/v0a737/reg";
const MASQUE_API_HOSTS = [
  "https://api.devices.cloudflare.com",
  "https://api.cloudflareclient.com",
];
const MASQUE_REG_PATH = "/v0a4471/reg";
const MASQUE_CLIENT_VERSION = "a-6.35-4471";
const MASQUE_USER_AGENT = "WARP for Android";

const ASSETS: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/index.html": { file: "index.html", type: "text/html; charset=utf-8" },
  "/style.css": { file: "style.css", type: "text/css; charset=utf-8" },
  "/client.js": { file: "client.js", type: "text/javascript; charset=utf-8" },
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

function decodeBase64(value: string): Uint8Array | null {
  try {
    return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

function validWireGuardPublicKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]{43}=$/.test(value)) return false;
  return decodeBase64(value)?.length === 32;
}

function validP256Spki(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 512) return false;
  const bytes = decodeBase64(value);
  return Boolean(bytes && bytes.length >= 80 && bytes.length <= 120 && bytes[0] === 0x30);
}

function randomBase64(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return btoa(String.fromCharCode(...bytes));
}

function peerPublicKeyDer(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "");
  const bytes = decodeBase64(clean);
  if (!bytes || bytes.length < 64 || bytes[0] !== 0x30) return null;
  return clean;
}

async function readInput(req: Request): Promise<Record<string, unknown> | Response> {
  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > 8192) return json({ error: "Request too large" }, 413);
  try {
    return await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
}

async function registerWireGuard(req: Request): Promise<Response> {
  const input = await readInput(req);
  if (input instanceof Response) return input;

  if (!validWireGuardPublicKey(input.key)) {
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
      headers: { "content-type": "application/json", "accept": "application/json" },
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

async function cloudflareMasqueRequest(
  base: string,
  method: "POST" | "PATCH",
  path: string,
  token: string,
  payload: unknown,
): Promise<any> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "accept": "application/json",
    "user-agent": MASQUE_USER_AGENT,
    "cf-client-version": MASQUE_CLIENT_VERSION,
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const reason = data?.errors?.[0]?.message || data?.message || text.slice(0, 180) || `HTTP ${response.status}`;
    throw new Error(`${new URL(base).hostname}: ${reason}`);
  }
  if (!data) throw new Error(`${new URL(base).hostname}: empty response`);
  return data;
}

async function registerMasque(req: Request): Promise<Response> {
  const input = await readInput(req);
  if (input instanceof Response) return input;

  if (!validP256Spki(input.key)) {
    return json({ error: "Invalid MASQUE P-256 public key" }, 400);
  }
  if (!validWireGuardPublicKey(input.wgKey)) {
    return json({ error: "Invalid enrollment X25519 public key" }, 400);
  }

  let lastError = "unknown error";

  for (const base of MASQUE_API_HOSTS) {
    try {
      const first = await cloudflareMasqueRequest(base, "POST", MASQUE_REG_PATH, "", {
        key: input.wgKey,
        install_id: "",
        fcm_token: "",
        tos: new Date().toISOString(),
        model: "PC",
        serial_number: randomBase64(8),
        os_version: "10",
        key_type: "curve25519",
        tunnel_type: "wireguard",
        locale: "en_US",
      });

      if (!first?.id || !first?.token) throw new Error("registration response missing id or token");

      const enrolled = await cloudflareMasqueRequest(
        base,
        "PATCH",
        `${MASQUE_REG_PATH}/${encodeURIComponent(first.id)}`,
        first.token,
        {
          key: input.key,
          key_type: "secp256r1",
          tunnel_type: "masque",
          name: "warp-generator",
        },
      );

      const peer = enrolled?.config?.peers?.[0]?.public_key;
      const addresses = enrolled?.config?.interface?.addresses;
      const peerDer = peerPublicKeyDer(peer);
      if (!peer || !peerDer || !addresses?.v4) {
        throw new Error("MASQUE enrollment response is incomplete");
      }

      return json({
        ipv4: addresses.v4,
        ipv6: addresses.v6 || null,
        peerPublicKey: peer,
        peerPublicKeyDer: peerDer,
        deviceId: first.id,
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return json({ error: `MASQUE registration failed: ${lastError}` }, 502);
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
    return json({ ok: true, runtime: "deno-deploy", protocols: ["wireguard", "masque"] });
  }

  if (req.method === "POST" && url.pathname === "/api/register") {
    return await registerWireGuard(req);
  }

  if (req.method === "POST" && url.pathname === "/api/register-masque") {
    return await registerMasque(req);
  }

  if (req.method === "GET" || req.method === "HEAD") {
    const response = await serveAsset(url.pathname);
    if (req.method === "HEAD") return new Response(null, { status: response.status, headers: response.headers });
    return response;
  }

  return new Response("Method not allowed", { status: 405 });
});
