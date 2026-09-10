# Cloudflare Worker backend

Этот Worker нужен только для серверного POST к Cloudflare WARP API. Приватный WireGuard-ключ через Worker не проходит: он создаётся в браузере, а Worker получает только публичный ключ.

## Быстрый деплой через Cloudflare Dashboard

1. В Cloudflare открой **Workers & Pages → Create → Worker**.
2. Назови Worker `warp-amnezia-api`.
3. В редакторе замени код содержимым `worker/src/index.js`.
4. Нажми **Deploy**.
5. Скопируй адрес вида `https://warp-amnezia-api.<subdomain>.workers.dev`.
6. Вставь его на GitHub Pages в поле **Cloudflare Worker URL**.

CORS разрешён только для `https://l33kr.github.io`.

## Через Wrangler

Из корня репозитория:

```bash
npx wrangler deploy
```

Конфигурация уже лежит в `wrangler.toml`.
