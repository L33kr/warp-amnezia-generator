(() => {
  'use strict';

  const WARP_API = 'https://api.cloudflareclient.com/v0a737/reg';
  const $ = (id) => document.getElementById(id);
  const state = { privateKey: null, config: null };

  const generateBtn = $('generateBtn');
  const result = $('result');
  const status = $('status');
  const error = $('error');
  const proxyMode = $('proxyMode');
  const customProxyWrap = $('customProxyWrap');

  proxyMode.addEventListener('change', () => {
    customProxyWrap.classList.toggle('hidden', proxyMode.value !== 'custom');
  });

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

  function proxyCandidates(target) {
    const corsBridge = `https://api.cors.syrins.tech/?url=${encodeURIComponent(target)}`;
    const thingProxy = `https://thingproxy.freeboard.io/fetch/${target}`;
    const corsProxyIo = `https://corsproxy.io/?url=${encodeURIComponent(target)}`;

    if (proxyMode.value === 'auto') {
      return [
        { name: 'CorsBridge', url: corsBridge },
        { name: 'ThingProxy', url: thingProxy },
        { name: 'corsproxy.io', url: corsProxyIo }
      ];
    }
    if (proxyMode.value === 'corsbridge') return [{ name: 'CorsBridge', url: corsBridge }];
    if (proxyMode.value === 'thingproxy') return [{ name: 'ThingProxy', url: thingProxy }];
    if (proxyMode.value === 'corsproxyio') return [{ name: 'corsproxy.io', url: corsProxyIo }];

    const custom = $('customProxy').value.trim();
    if (!custom) throw new Error('Укажи URL своего CORS proxy.');
    const url = custom.includes('{url}')
      ? custom.replace('{url}', encodeURIComponent(target))
      : custom + encodeURIComponent(target);
    return [{ name: 'Custom proxy', url }];
  }

  function options() {
    const routeMode = $('routeMode').value;
    return {
      dns: $('dnsPreset').value,
      mtu: Number($('mtu').value || 1280),
      keepalive: Number($('keepalive').value || 0),
      deviceType: $('deviceType').value.trim() || 'Android',
      locale: $('locale').value.trim() || 'en_US',
      endpointOverride: $('endpointOverride').value.trim(),
      allowedIps: routeMode === 'ipv4' ? '0.0.0.0/0' : '0.0.0.0/0, ::/0',
      includeIpv6: routeMode !== 'ipv4'
    };
  }

  async function parseResponse(response) {
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`не-JSON ответ (HTTP ${response.status})`);
    }

    // Некоторые прокси могут завернуть upstream-body в поле contents/body/data.
    for (const key of ['contents', 'body', 'data']) {
      if (typeof data?.[key] === 'string') {
        try {
          const nested = JSON.parse(data[key]);
          if (nested && typeof nested === 'object') data = nested;
        } catch { /* оставляем исходный объект */ }
      }
    }
    return data;
  }

  async function register(publicKey, opts) {
    const payload = {
      key: publicKey,
      install_id: '',
      warp_enabled: true,
      tos: new Date().toISOString(),
      type: opts.deviceType,
      locale: opts.locale
    };

    const attempts = [];
    const candidates = proxyCandidates(WARP_API);

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      if (candidates.length > 1) {
        setStatus(`2/3 Регистрирую WARP-профиль через ${candidate.name} (${i + 1}/${candidates.length})…`);
      }

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        let response;
        try {
          response = await fetch(candidate.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(payload),
            cache: 'no-store',
            signal: controller.signal
          });
        } finally {
          clearTimeout(timer);
        }

        const data = await parseResponse(response);
        if (response.ok && data?.config?.peers?.[0] && data?.config?.interface?.addresses?.v4) {
          return data;
        }

        const reason = data?.errors?.[0]?.message || data?.error?.message || data?.message || `HTTP ${response.status}`;
        attempts.push(`${candidate.name}: ${reason}`);
      } catch (e) {
        const reason = e?.name === 'AbortError' ? 'тайм-аут' : (e?.message || 'ошибка сети/CORS');
        attempts.push(`${candidate.name}: ${reason}`);
      }
    }

    throw new Error(`Не удалось зарегистрировать WARP-профиль. ${attempts.join(' | ')}`);
  }

  function buildConfig(privateKey, warp, opts) {
    const iface = warp.config.interface;
    const peer = warp.config.peers[0];
    if (!iface?.addresses?.v4 || !peer?.public_key) throw new Error('Cloudflare вернул неполную конфигурацию.');

    const addresses = [`${iface.addresses.v4}/32`];
    if (opts.includeIpv6 && iface.addresses.v6) addresses.push(`${iface.addresses.v6}/128`);
    const endpoint = opts.endpointOverride || peer?.endpoint?.host;
    if (!endpoint) throw new Error('В ответе Cloudflare отсутствует Endpoint.');

    const lines = [
      '[Interface]',
      `PrivateKey = ${privateKey}`,
      `Address = ${addresses.join(', ')}`,
      `DNS = ${opts.dns}`,
      `MTU = ${opts.mtu}`,
      '',
      '[Peer]',
      `PublicKey = ${peer.public_key}`,
      `AllowedIPs = ${opts.allowedIps}`,
      `Endpoint = ${endpoint}`
    ];
    if (opts.keepalive > 0) lines.push(`PersistentKeepalive = ${opts.keepalive}`);
    return { text: lines.join('\n') + '\n', endpoint };
  }

  function wipeState() {
    state.privateKey = null;
    state.config = null;
    $('config').value = '';
    result.classList.add('hidden');
  }

  generateBtn.addEventListener('click', async () => {
    clearMessages();
    result.classList.add('hidden');
    generateBtn.disabled = true;
    generateBtn.textContent = 'Создаю…';

    try {
      setStatus('1/3 Генерирую WireGuard-ключи локально…');
      const keys = window.wireguard.generateKeypair();
      state.privateKey = keys.privateKey;

      setStatus('2/3 Регистрирую новый WARP-профиль…');
      const opts = options();
      const warp = await register(keys.publicKey, opts);

      setStatus('3/3 Собираю конфигурацию для AmneziaVPN…');
      const built = buildConfig(keys.privateKey, warp, opts);
      state.config = built.text;

      $('config').value = built.text;
      $('ipv4').textContent = warp.config.interface.addresses.v4 || '—';
      $('ipv6').textContent = opts.includeIpv6 ? (warp.config.interface.addresses.v6 || '—') : 'отключён';
      $('endpoint').textContent = built.endpoint;
      $('deviceId').textContent = warp.id || '—';
      $('accountType').textContent = warp.account?.warp_plus ? 'WARP+' : 'WARP Free';
      result.classList.remove('hidden');
      status.classList.add('hidden');
    } catch (e) {
      wipeState();
      setError(`${e.message}\n\nПопробуй ещё раз. Если публичные CORS proxy недоступны, используй резервный workflow во вкладке Actions.`);
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Создать WARP config';
    }
  });

  $('copyBtn').addEventListener('click', async () => {
    if (!state.config) return;
    try {
      await navigator.clipboard.writeText(state.config);
      const old = $('copyBtn').textContent;
      $('copyBtn').textContent = 'Скопировано';
      setTimeout(() => $('copyBtn').textContent = old, 1600);
    } catch {
      setError('Браузер не разрешил доступ к буферу обмена.');
    }
  });

  $('downloadBtn').addEventListener('click', () => {
    if (!state.config) return;
    const blob = new Blob([state.config], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'warp-amnezia.conf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  $('clearBtn').addEventListener('click', () => {
    wipeState();
    clearMessages();
  });

  window.addEventListener('beforeunload', wipeState);
})();
