# Внешние модули (расширения)

Здесь лежат сторонние модули, изначально сделанные для Owlbear Rodeo.
Их **исходники не редактируются** — они хранятся как есть и адаптируются
на уровне хоста VTT.

## troika-initiative

«Стек инициативы Тройка!» — трекер инициативы по правилам «Тройки!».
Оригинал: отдельный проект `troika-initiative` (Owlbear Rodeo, manifest v1).

Файлы скопированы без изменений:

- `index.html`, `app.js`, `styles.css`, `icon.svg`
- `manifest.json`, `README.md` — как в оригинале

Адаптация:

1. `obr-shim.js` — наш файл. Реализует тот срез `@owlbear-rodeo/sdk`,
   который использует расширение (`isAvailable`, `onReady`, `player.getRole`,
   `player.onChange`, `scene.getMetadata`, `scene.setMetadata`,
   `scene.onMetadataChange`) и обменивается сообщениями с приложением VTT.
2. HTTP-сервер хоста отдаёт `app.js` с заменой только URL импорта SDK
   (CDN → `/extensions/troika-initiative/obr-shim.js`). Файл на диске
   остаётся неизменным.
3. Состояние расширения хранится в сессии VTT (`extensionState`)
   и синхронизируется событием `extension:update`, поэтому Мастер и игроки
   видят один и тот же трекер.

Чтобы обновить модуль до новой версии оригинала, скопируйте файлы заново
(кроме `obr-shim.js`) и проверьте, что используемые места SDK не изменились.
