# WARP → AmneziaVPN Config Generator

Генератор Cloudflare WARP WireGuard-конфигураций для импорта в **AmneziaVPN**.

## Как пользоваться

1. Открой сайт: **https://warp-amnezia-generator.l33kr.deno.net/**
2. Выбери режим маршрутизации:
   - **Весь трафик (IPv4 + IPv6)** — обычный вариант.
   - **Только IPv4** — если IPv6 не нужен или работает нестабильно.
3. Выбери DNS:
   - Cloudflare
   - Comss.one
   - Xbox DNS
   - Quad9
   - Google
4. При необходимости открой **Расширенные настройки** и измени WARP Endpoint, UDP-порт, MTU или PersistentKeepalive.
5. Нажми **Создать WARP config**.
6. После успешной генерации нажми **Скачать .conf**.
7. Открой AmneziaVPN и импортируй скачанный `warp-amnezia.conf` как обычную конфигурацию **WireGuard**.

## Если AmneziaVPN зависает на Connecting

По умолчанию используется endpoint:

```text
162.159.192.1:2408
```

Если подключения нет, создай новый конфиг, выбрав другой UDP-порт в расширенных настройках:

```text
500
1701
4500
```

## Важно

Сгенерированный `.conf` содержит приватный WireGuard-ключ. Не публикуй его и не отправляй посторонним.

Это обычный WireGuard-профиль Cloudflare WARP для импорта в AmneziaVPN, а не AmneziaWG.
