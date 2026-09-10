# WARP → AmneziaVPN Config Generator

Бесплатный генератор Cloudflare WARP WireGuard-конфигураций для импорта в **AmneziaVPN**.

## Что это

- GitHub Pages: интерфейс работает как статический сайт.
- Приватный WireGuard-ключ генерируется локально в браузере.
- В Cloudflare отправляется только публичный ключ и технические данные регистрации устройства.
- Из-за CORS регистрация из браузера идёт через выбранный CORS proxy.
- Если proxy недоступен, есть резервный GitHub Actions workflow, который генерирует конфиг на GitHub runner.
- Никакого собственного VPS/backend не требуется.

> Это обычный **WireGuard**-профиль Cloudflare WARP, совместимый с импортом в AmneziaVPN. Это не протокол AmneziaWG и не добавляет AWG-обфускацию к серверам Cloudflare.

## Включение GitHub Pages

1. Для бесплатного GitHub Pages на GitHub Free репозиторий должен быть публичным.
2. Открой `Settings → Pages`.
3. В `Build and deployment → Source` выбери **GitHub Actions**.
4. Открой `Actions → Deploy GitHub Pages` и дождись успешного deploy.
5. Сайт будет доступен по адресу `https://USERNAME.github.io/REPOSITORY/`.

Пока репозиторий приватный, резервная генерация через GitHub Actions продолжает работать в пределах бесплатной квоты Actions твоего аккаунта.

## Генерация через сайт

Открой GitHub Pages и нажми **Создать WARP config**. Скачай `warp-amnezia.conf`, затем импортируй его в AmneziaVPN как WireGuard-конфигурацию.

## Резервная генерация через GitHub Actions

1. `Actions → Generate WARP config → Run workflow`.
2. После завершения открой run.
3. Внизу в `Artifacts` скачай `warp-amnezia-config`.
4. Внутри будет `warp-amnezia.conf`.

Artifact хранится 1 день, чтобы приватный ключ не лежал в GitHub дольше необходимого.

## Безопасность

Не публикуй сгенерированный `.conf`: он содержит приватный ключ. Сам репозиторий не содержит заранее созданных профилей или секретов.

Браузерный режим использует сторонний CORS proxy. Приватный ключ через него **не передаётся**, однако публичный ключ и регистрационный payload проходят через этот proxy. Если это нежелательно, используй GitHub Actions.

## Лицензия

GPL-2.0-only. `wireguard.js` основан на GPL-2.0 коде WireGuard для генерации X25519/WireGuard ключей.

Cloudflare/WARP, WireGuard и Amnezia — торговые марки соответствующих владельцев. Проект не аффилирован с ними.
