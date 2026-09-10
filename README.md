# WARP → AmneziaVPN Config Generator

Бесплатный генератор Cloudflare WARP WireGuard-конфигураций для импорта в **AmneziaVPN**.

Основной вариант развёртывания — **Deno Deploy**: сайт и backend работают на одном домене, поэтому не нужны CORS proxy, Cloudflare Worker или переходы в GitHub Actions.

## Что происходит при генерации

1. WireGuard private/public keypair создаётся локально в браузере.
2. В `/api/register` отправляется только публичный ключ.
3. Deno Deploy делает серверный POST в Cloudflare WARP API.
4. В браузер возвращаются WARP IPv4/IPv6, peer public key и технические данные профиля.
5. Браузер собирает `warp-amnezia.conf` и предлагает скачать его.

Приватный ключ не отправляется в Deno и не коммитится в GitHub.

## Deno Deploy

Deno Deploy должен запускать серверный entrypoint `app.js` или `main.ts`.

- `app.js` — серверный bootstrap, импортирует `main.ts`.
- `main.ts` — HTTP server + `/api/register`.
- `client.js` — браузерный код интерфейса.
- `index.html` — интерфейс.

Такое разделение важно: браузерный код использует `document`, которого нет в серверном runtime Deno.

## Локальный запуск

```bash
deno task dev
```

Проверка backend:

```text
GET /api/health
```

должна вернуть JSON с `ok: true`.

## Endpoint

Генератор по умолчанию использует прямой WARP endpoint `162.159.192.1:2408`. В интерфейсе можно выбрать резервные UDP-порты `500`, `1701` и `4500`, если сеть блокирует основной порт.

## GitHub Actions

Workflow `Generate WARP config` оставлен как резервный вариант. Для обычной работы после Deno Deploy он не нужен.

## Безопасность

Не публикуй сгенерированный `.conf`: в нём находится приватный WireGuard-ключ.

## Лицензия

GPL-2.0-only.

Cloudflare/WARP, WireGuard, Deno и Amnezia — торговые марки соответствующих владельцев. Проект не аффилирован с ними.
