# WARP Config Generator

Генератор Cloudflare WARP профилей с двумя вариантами подключения:

- **MASQUE** — основной вариант. Поддерживает Auto (HTTP/3 → HTTP/2), HTTP/3 и HTTP/2.
- **WireGuard** — резервный вариант для импорта в AmneziaVPN.

Сайт: **https://warp-amnezia-generator.l33kr.deno.net/**

## MASQUE

1. Открой сайт.
2. Выбери **MASQUE**.
3. Оставь **Auto — H3 → H2**: сначала используется HTTP/3, а при проблемах с QUIC клиент может перейти на HTTP/2/TCP.
4. Нажми **Создать MASQUE**.
5. Нажми **Копировать ссылку** и добавь `masque://...` в совместимый клиент или скачай `warp-masque.json`.

Клиенты:

- Android: **LxBox** — https://github.com/Leadaxe/LxBox/releases/latest
- Windows / macOS: **Sing-Box Launcher** — https://github.com/Leadaxe/singbox-launcher/releases/latest

Приватный ECDSA P-256 ключ MASQUE создаётся локально в браузере. На backend отправляется только публичный ключ.

## WireGuard / AmneziaVPN

1. Выбери **WireGuard**.
2. Выбери DNS и при необходимости endpoint/порт.
3. Нажми **Создать WireGuard**.
4. Скачай `warp-amnezia.conf`.
5. Импортируй файл в AmneziaVPN как WireGuard.

AmneziaVPN: https://amnezia.org/ru/downloads

Если WireGuard не подключается, попробуй другой UDP-порт: `500`, `1701` или `4500`.

## Важно

Сгенерированные профили содержат приватный ключ. Не публикуй их и не отправляй посторонним.
