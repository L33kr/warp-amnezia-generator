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

## Бесплатный деплой на Deno Deploy

Deno Deploy Free подходит для этого проекта с большим запасом: на бесплатном тарифе доступны до 1 млн HTTP-запросов в месяц и 20 GiB egress.

1. Открой `https://console.deno.com` и войди через GitHub.
2. Создай organization, если Deno попросит.
3. Создай новое приложение и выбери **Deploy from GitHub**.
4. Выбери репозиторий `L33kr/warp-amnezia-generator`.
5. Runtime mode: **Dynamic**.
6. Entrypoint: **`main.ts`**.
7. Production branch: **`main`**.
8. Region можно оставить **Global**.
9. Нажми Deploy.

После публикации Deno выдаст домен приложения. Открой его — генератор будет работать полностью на нём.

### CLI-вариант

Если используешь Deno CLI, приложение можно создать через `deno deploy create` с GitHub source, dynamic runtime и entrypoint `main.ts`.

## Локальный запуск

```bash
deno task dev
```

Открой `http://localhost:8000`.

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

## Структура

- `main.ts` — Deno HTTP server + `/api/register`.
- `index.html` — интерфейс.
- `app.js` — локальная генерация ключей, вызов API и сборка `.conf`.
- `wireguard.js` — X25519/WireGuard key generation.
- `deno.json` — локальные Deno tasks.
- `.github/workflows/generate.yml` — резервный Actions-генератор.
- `worker/` — старый альтернативный вариант через Cloudflare Worker; для Deno Deploy не требуется.

## Лицензия

GPL-2.0-only.

Cloudflare/WARP, WireGuard, Deno и Amnezia — торговые марки соответствующих владельцев. Проект не аффилирован с ними.
