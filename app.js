(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const state = { privateKey: null, config: null };

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

  function options() {
    const routeMode = $('routeMode').value;
    return {
      dns: $('dnsPreset').value,
      mtu: Number($('mtu').value || 1280),
      keepalive: Number($('keepalive').value || 0),
      endpointIp: $('endpointIp').value.trim() || '162.159.192.1',
      port: $('warpPort').value,
      allowedIps: routeMode === 'ipv4' ? '0.0.0.0/0' : '0.0.0.0/0, ::/0',
      includeIpv6: routeMode !== 'ipv4'
    };
  }

  async function register(publicKey) {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        key: publicKey,
        type: 'Android',
        locale: 'en_US'
      }),
      cache: 'no-store'
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(`Сервер вернул некорректный ответ (HTTP ${response.status}).`);
    }

    if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
    if (!data?.ipv4 || !data?.peerPublicKey) throw new Error('Deno backend вернул неполную WARP-конфигурацию.');
    return data;
  }

  function buildConfig(privateKey, warp, opts) {
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
      if (location.hostname.endsWith('.github.io')) {
        throw new Error('Эта версия должна быть открыта через Deno Deploy: GitHub Pages не умеет выполнять /api/register.');
      }

      setStatus('1/3 Генерирую WireGuard-ключи локально…');
      const keys = window.wireguard.generateKeypair();
      state.privateKey = keys.privateKey;

      setStatus('2/3 Регистрирую WARP-профиль через Deno Deploy…');
      const warp = await register(keys.publicKey);

      setStatus('3/3 Собираю конфигурацию…');
      const opts = options();
      const built = buildConfig(keys.privateKey, warp, opts);
      state.config = built.text;

      $('config').value = built.text;
      $('ipv4').textContent = warp.ipv4 || '—';
      $('ipv6').textContent = opts.includeIpv6 ? (warp.ipv6 || '—') : 'отключён';
      $('endpoint').textContent = built.endpoint;
      $('deviceId').textContent = warp.deviceId || '—';
      $('accountType').textContent = warp.warpPlus ? 'WARP+' : 'WARP Free';
      result.classList.remove('hidden');
      status.classList.add('hidden');
    } catch (e) {
      wipeState();
      setError(e?.message || 'Не удалось создать WARP config.');
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
