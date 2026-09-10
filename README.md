# WARP → AmneziaVPN Config Generator

Бесплатный генератор Cloudflare WARP WireGuard-конфигураций для импорта в **AmneziaVPN**.

## Архитектура

- **GitHub Pages** — интерфейс.
- **Cloudflare Worker Free** — маленький backend только для регистрации WARP-профиля.
- Приватный WireGuard-ключ генерируется **локально в браузере** и в Worker не отправляется.
- Worker получает только публичный ключ, обращается к Cloudflare WARP API и возвращает IPv4/IPv6, peer public key и device id.
- Готовый `warp-amnezia.conf` собирается и скачивается прямо в браузере.

## Почему нужен Worker

GitHub Pages — статический хостинг, а WARP API не разрешает прямой browser POST из-за CORS. Публичные CORS proxy нестабильны, поэтому проект использует собственный бесплатный Cloudflare Worker.

## Развернуть Worker

Код уже готов в `worker/src/index.js`.

### Через Cloudflare Dashboard

1. Cloudflare → **Workers & Pages → Create → Worker**.
2. Назови его `warp-amnezia-api`.
3. Замени код Worker содержимым `worker/src/index.js`.
4. Нажми **Deploy**.
5. Скопируй URL вида `https://warp-amnezia-api.<subdomain>.workers.dev`.
6. Вставь URL на сайте в поле **Cloudflare Worker URL**.

CORS Worker разрешён только для `https://l33kr.github.io`.

### Через Wrangler

```bash
npx wrangler deploy
```

`wrangler.toml` уже находится в корне репозитория.

## Endpoint WARP

По умолчанию проект использует прямой consumer WARP endpoint:

```text
162.159.192.1:2408
```

Это сделано специально для обычного WireGuard/AmneziaVPN вместо `engage.cloudflareclient.com`. В интерфейсе также доступны резервные UDP-порты `500`, `1701` и `4500`.

## Резервный GitHub Actions генератор

`Actions → Generate WARP config → Run workflow` по-прежнему оставлен как fallback. Он тоже использует прямой endpoint и позволяет выбрать порт.

## Безопасность

Не публикуй сгенерированный `.conf`: он содержит приватный ключ. Репозиторий и Worker приватный ключ не сохраняют.

> Это обычный WireGuard-профиль Cloudflare WARP. Это не AmneziaWG и не добавляет AWG-обфускацию.

## Лицензия

GPL-2.0-only. `wireguard.js` основан на GPL-2.0 коде WireGuard для X25519/WireGuard keypair generation.
