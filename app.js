(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const WORKER_KEY = 'warpAmneziaWorkerUrl';
  const DEFAULT_ENDPOINT = '162.159.192.1';
  const state = { privateKey: null, config: null };

  const workerUrl = $('workerUrl');
  const savedWorker = localStorage.getItem(WORKER_KEY);
  if (savedWorker) workerUrl.value = savedWorker;

  const normalizeWorkerUrl = (value) => value.trim().replace(/\/+$/, '');

  function setStatus(message) {
    $('status').textContent = message;
    $('status').classList.remove('hidden');
    $('error').classList.add('hidden');
  }

  function setError(message) {
    $('error').textContent = message;
    $('error').classList.remove('hidden');
    $('status').classList.add('hidden');
  }

  function clearMessages() {
    $('status').classList.add('hidden');
    $('error').classList.add('hidden');
  }

  function options() {
    const full = $('routeMode').value === 'full';
    return {
      dns: $('dnsPreset').value,
      mtu: Number($('mtu').value || 1280),
      keepalive: Number($('keepalive').value || 25),
      port: Number($('warpPort').value || 2408),
      endpoint: $('endpointIp').value.trim() || DEFAULT_ENDPOINT,
      allowedIps: full ? '0.0.0.0/0, ::/0' : '0.0.0.0/0',
      includeIpv6: full
    };
  }

  async function register(publicKey) {
    const base = normalizeWorkerUrl(workerUrl.value);
    if (!/^https:\/\//i.test(base)) {
      throw new Error('Укажи HTTPS-адрес своего Cloudflare Worker. Он нужен один раз; сайт запомнит его в этом браузере.');
    }
    localStorage.setItem(WORKER_KEY, base);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let response;
    try {
      response = await fetch(`${base}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ key: publicKey, type: 'Android', locale: 'en_US' }),
        cache: 'no-store',
        signal: controller.signal
      });
    } catch (e) {
      if (e?.name === 'AbortError') throw new Error('Cloudflare Worker не ответил за 20 секунд.');
      throw new Error(`Не удалось обратиться к Worker: ${e?.message || 'ошибка сети'}`);
    } finally {
      clearTimeout(timer);
    }

    let data;
    try { data = await response.json(); }
    catch { throw new Error(`Worker вернул не-JSON ответ (HTTP ${response.status}).`); }

    if (!response.ok || !data?.peerPublicKey || !data?.ipv4) {
      throw new Error(data?.error || `Ошибка регистрации WARP (HTTP ${response.status}).`);
    }
    return data;
  }

  function buildConfig(privateKey, warp, opts) {
    const addresses = [`${warp.ipv4}/32`];
    if (opts.includeIpv6 && warp.ipv6) addresses.push(`${warp.ipv6}/128`);

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
      `Endpoint = ${opts.endpoint}:${opts.port}`
    ];
    if (opts.keepalive > 0) lines.push(`PersistentKeepalive = ${opts.keepalive}`);
    return lines.join('\n') + '\n';
  }

  function wipeState() {
    state.privateKey = null;
    state.config = null;
    $('config').value = '';
    $('result').classList.add('hidden');
  }

  $('generateBtn').addEventListener('click', async () => {
    clearMessages();
    wipeState();
    const button = $('generateBtn');
    button.disabled = true;
    button.textContent = 'Создаю…';

    try {
      setStatus('1/3 Генерирую WireGuard-ключи локально…');
      const keys = window.wireguard.generateKeypair();
      state.privateKey = keys.privateKey;

      setStatus('2/3 Регистрирую WARP-профиль через твой Cloudflare Worker…');
      const warp = await register(keys.publicKey);

      setStatus('3/3 Собираю конфигурацию для AmneziaVPN…');
      const opts = options();
      state.config = buildConfig(keys.privateKey, warp, opts);

      $('config').value = state.config;
      $('ipv4').textContent = warp.ipv4 || '—';
      $('ipv6').textContent = opts.includeIpv6 ? (warp.ipv6 || '—') : 'отключён';
      $('endpoint').textContent = `${opts.endpoint}:${opts.port}`;
      $('deviceId').textContent = warp.deviceId || '—';
      $('accountType').textContent = warp.warpPlus ? 'WARP+' : 'WARP Free';
      $('result').classList.remove('hidden');
      $('status').classList.add('hidden');
    } catch (e) {
      wipeState();
      setError(e?.message || String(e));
    } finally {
      button.disabled = false;
      button.textContent = 'Создать WARP config';
    }
  });

  $('downloadBtn').addEventListener('click', () => {
    if (!state.config) return;
    const url = URL.createObjectURL(new Blob([state.config], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'warp-amnezia.conf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  $('copyBtn').addEventListener('click', async () => {
    if (!state.config) return;
    try {
      await navigator.clipboard.writeText(state.config);
      const old = $('copyBtn').textContent;
      $('copyBtn').textContent = 'Скопировано';
      setTimeout(() => $('copyBtn').textContent = old, 1500);
    } catch {
      setError('Браузер не разрешил доступ к буферу обмена.');
    }
  });

  $('clearBtn').addEventListener('click', () => {
    wipeState();
    clearMessages();
  });
})();
