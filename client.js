(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const state = {
    secret: null,
    copyText: null,
    downloadText: null,
    filename: null,
    mime: 'text/plain;charset=utf-8'
  };

  const generateBtn = $('generateBtn');
  const result = $('result');
  const status = $('status');
  const error = $('error');

  function setStatus(message) {
    status.textContent = message;
    status.classList.remove('hidden');
    error.classList.add('hidden');
  }

  function setError(message) {
    error.textContent = message;
    error.classList.remove('hidden');
    status.classList.add('hidden');
  }

  function clearMessages() {
    status.classList.add('hidden');
    error.classList.add('hidden');
  }

  function toggle(id, show) {
    $(id).classList.toggle('hidden', !show);
  }

  function currentProtocol() {
    return $('protocol').value;
  }

  function updateProtocolUI() {
    const masque = currentProtocol() === 'masque';
    toggle('masqueOptions', masque);
    toggle('wireguardOptions', !masque);
    toggle('masqueAdvanced', masque);
    toggle('masqueClients', masque);
    toggle('wireguardClients', !masque);
    toggle('dnsField', !masque);
    generateBtn.textContent = masque ? 'Создать MASQUE' : 'Создать WireGuard';
    wipeState();
    clearMessages();
  }

  function routeOptions() {
    const ipv4Only = $('routeMode').value === 'ipv4';
    return { ipv4Only, includeIpv6: !ipv4Only };
  }

  function wireguardOptions() {
    const route = routeOptions();
    return {
      ...route,
      dns: $('dnsPreset').value,
      mtu: Number($('mtu').value || 1280),
      keepalive: Number($('keepalive').value || 0),
      endpointIp: $('endpointIp').value.trim() || '162.159.192.1',
      port: $('warpPort').value,
      allowedIps: route.ipv4Only ? '0.0.0.0/0' : '0.0.0.0/0, ::/0'
    };
  }

  function masqueOptions() {
    const route = routeOptions();
    return {
      ...route,
      transport: $('masqueTransport').value,
      endpoint: $('masqueEndpoint').value.trim() || '162.159.198.2',
      port: Number($('masquePort').value || 443),
      sni: $('masqueSni').value.trim() || 'www.microsoft.com',
      mtu: Number($('masqueMtu').value || 1280)
    };
  }

  function bytesToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function base64UrlToBytes(value) {
    let s = value.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const raw = atob(s);
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }

  function concatBytes(...parts) {
    const size = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  }

  function p256Sec1FromJwk(jwk) {
    const d = base64UrlToBytes(jwk.d);
    const x = base64UrlToBytes(jwk.x);
    const y = base64UrlToBytes(jwk.y);
    if (d.length !== 32 || x.length !== 32 || y.length !== 32) {
      throw new Error('Браузер вернул неожиданный P-256 ключ.');
    }

    return concatBytes(
      new Uint8Array([0x30, 0x77, 0x02, 0x01, 0x01, 0x04, 0x20]),
      d,
      new Uint8Array([0xa0, 0x0a, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]),
      new Uint8Array([0xa1, 0x44, 0x03, 0x42, 0x00, 0x04]),
      x,
      y
    );
  }

  async function generateMasqueKeypair() {
    if (!crypto?.subtle) throw new Error('Этот браузер не поддерживает WebCrypto.');
    const pair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    );
    const publicDer = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
    const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
    const privateDer = p256Sec1FromJwk(privateJwk);
    return {
      publicKey: bytesToBase64(publicDer),
      privateKey: bytesToBase64(privateDer)
    };
  }

  async function fetchJson(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store'
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(`Сервер вернул некорректный ответ (HTTP ${response.status}).`);
    }
    if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
    return data;
  }

  async function registerWireGuard(publicKey) {
    const data = await fetchJson('/api/register', { key: publicKey, type: 'Android', locale: 'en_US' });
    if (!data?.ipv4 || !data?.peerPublicKey) throw new Error('Backend вернул неполную WireGuard-конфигурацию.');
    return data;
  }

  async function registerMasque(publicKey, enrollmentWgPublicKey) {
    const data = await fetchJson('/api/register-masque', { key: publicKey, wgKey: enrollmentWgPublicKey });
    if (!data?.ipv4 || !data?.peerPublicKeyDer) throw new Error('Backend вернул неполную MASQUE-конфигурацию.');
    return data;
  }

  function buildWireGuard(privateKey, warp, opts) {
    const addresses = [`${warp.ipv4}/32`];
    if (opts.includeIpv6 && warp.ipv6) addresses.push(`${warp.ipv6}/128`);
    const endpoint = `${opts.endpointIp}:${opts.port}`;
    const lines = [
      '[Interface]',
      `PrivateKey = ${privateKey}`,
      `Address = ${addresses.join(', ')}`,
      `DNS = ${opts.dns}`,
      `MTU = ${opts.mtu}`,
      '',
      '[Peer]',
      `PublicKey = ${warp.peerPublicKey}`,
      `AllowedIPs = ${opts.allowedIps}`,
      `Endpoint = ${endpoint}`
    ];
    if (opts.keepalive > 0) lines.push(`PersistentKeepalive = ${opts.keepalive}`);
    const text = `${lines.join('\n')}\n`;
    return {
      copyText: text,
      downloadText: text,
      filename: 'warp-amnezia.conf',
      mime: 'text/plain;charset=utf-8',
      endpoint,
      transport: 'WireGuard'
    };
  }

  function buildMasque(privateKey, warp, opts) {
    const addresses = [`${warp.ipv4}/32`];
    if (opts.includeIpv6 && warp.ipv6) addresses.push(`${warp.ipv6}/128`);

    const query = new URLSearchParams();
    query.set('publickey', warp.peerPublicKeyDer);
    query.set('address', addresses.join(','));
    query.set('profile', 'cloudflare');
    query.set('vhttp', opts.transport);
    query.set('sni', opts.sni);
    query.set('mtu', String(opts.mtu));

    const endpoint = `${opts.endpoint}:${opts.port}`;
    const uri = `masque://${encodeURIComponent(privateKey)}@${endpoint}?${query.toString()}#WARP%20MASQUE`;

    return {
      copyText: uri,
      downloadText: `${uri}\n`,
      filename: 'warp-masque.txt',
      mime: 'text/plain;charset=utf-8',
      endpoint,
      transport: opts.transport === 'auto' ? 'MASQUE Auto (H3 → H2)' : `MASQUE ${opts.transport.toUpperCase()}`
    };
  }

  function wipeState() {
    state.secret = null;
    state.copyText = null;
    state.downloadText = null;
    state.filename = null;
    $('config').value = '';
    result.classList.add('hidden');
  }

  function showResult(warp, built, includeIpv6, protocol) {
    state.copyText = built.copyText;
    state.downloadText = built.downloadText;
    state.filename = built.filename;
    state.mime = built.mime;

    $('resultTitle').textContent = built.filename;
    $('config').value = built.copyText;
    $('ipv4').textContent = warp.ipv4 || '—';
    $('ipv6').textContent = includeIpv6 ? (warp.ipv6 || '—') : 'отключён';
    $('endpoint').textContent = built.endpoint;
    $('transport').textContent = built.transport;
    $('accountType').textContent = protocol === 'masque' ? 'MASQUE' : (warp.warpPlus ? 'WARP+' : 'WARP Free');
    $('downloadBtn').textContent = protocol === 'masque' ? 'Скачать ссылку' : 'Скачать .conf';
    $('copyBtn').textContent = protocol === 'masque' ? 'Копировать ссылку' : 'Копировать';
    if (protocol === 'masque') {
      $('masqueResultHelp').innerHTML = 'В Sing-Box Launcher добавь эту <code>masque://</code> ссылку через <strong>Wizard → Sources</strong>. Не заменяй ею <code>bin/config.json</code>: это ссылка на один MASQUE-узел, а не полный sing-box конфиг.';
    }
    toggle('masqueResultHelp', protocol === 'masque');
    toggle('wireguardResultHelp', protocol !== 'masque');
    result.classList.remove('hidden');
    status.classList.add('hidden');
  }

  generateBtn.addEventListener('click', async () => {
    clearMessages();
    result.classList.add('hidden');
    generateBtn.disabled = true;
    const protocol = currentProtocol();
    const originalText = generateBtn.textContent;
    generateBtn.textContent = 'Создаю…';

    try {
      if (location.hostname.endsWith('.github.io')) {
        throw new Error('Открой генератор через Deno Deploy, а не GitHub Pages.');
      }

      if (protocol === 'masque') {
        setStatus('1/3 Создаю P-256 ключ локально…');
        const keys = await generateMasqueKeypair();
        const enrollment = window.wireguard.generateKeypair();
        state.secret = keys.privateKey;

        setStatus('2/3 Регистрирую WARP MASQUE…');
        const warp = await registerMasque(keys.publicKey, enrollment.publicKey);

        setStatus('3/3 Собираю MASQUE-профиль…');
        const opts = masqueOptions();
        const built = buildMasque(keys.privateKey, warp, opts);
        showResult(warp, built, opts.includeIpv6, protocol);
      } else {
        setStatus('1/3 Создаю WireGuard ключ локально…');
        const keys = window.wireguard.generateKeypair();
        state.secret = keys.privateKey;

        setStatus('2/3 Регистрирую WARP WireGuard…');
        const warp = await registerWireGuard(keys.publicKey);

        setStatus('3/3 Собираю WireGuard-конфиг…');
        const opts = wireguardOptions();
        const built = buildWireGuard(keys.privateKey, warp, opts);
        showResult(warp, built, opts.includeIpv6, protocol);
      }
    } catch (e) {
      wipeState();
      setError(e?.message || 'Не удалось создать WARP-профиль.');
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = originalText;
    }
  });

  $('copyBtn').addEventListener('click', async () => {
    if (!state.copyText) return;
    try {
      await navigator.clipboard.writeText(state.copyText);
      const old = $('copyBtn').textContent;
      $('copyBtn').textContent = 'Скопировано';
      setTimeout(() => $('copyBtn').textContent = old, 1600);
    } catch {
      setError('Браузер не разрешил доступ к буферу обмена.');
    }
  });

  $('downloadBtn').addEventListener('click', () => {
    if (!state.downloadText || !state.filename) return;
    const blob = new Blob([state.downloadText], { type: state.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = state.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  $('clearBtn').addEventListener('click', () => {
    wipeState();
    clearMessages();
  });

  $('protocol').addEventListener('change', updateProtocolUI);
  window.addEventListener('beforeunload', wipeState);
  updateProtocolUI();
})();
