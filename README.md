# VTT 2.0 — виртуальный стол для НРИ

Монорепозиторий по ТЗ: десктопное приложение Мастера (Electron) + веб-клиенты игроков
(React + Vite), синхронизация через Socket.io (порт 3001).

- **Мастер** запускает десктопное приложение: оно поднимает WebSocket-сервер, хранит сессии
  локально в JSON и раздаёт веб-клиент игрокам.
- **Игроки** открывают ссылку-приглашение в браузере — установка не нужна.

> Архитектура проекта — **everything is a plugin**. Стек, границы слоёв, правила разработки
> и чек-лист приёмки зафиксированы в [agent.md](agent.md).

## Структура

```
vtt-app/
├── desktop-host/            # Electron-приложение Мастера (хост + WebSocket-сервер + GM UI)
│   └── src/
│       ├── main/            # главный процесс: окно, сервер, сессии, хранение, туннель
│       ├── preload/         # contextBridge-API окна Мастера
│       ├── shared/          # типы IPC между процессами
│       └── renderer/        # React UI Мастера (стор Zustand, панели, тулбар)
├── web-client/              # веб-клиент игроков (React + Vite + Konva)
├── shared/                  # общие типы, утилиты и UI-компоненты канваса/панелей
│   ├── types/               # session, token, map, events
│   ├── utils/               # камера, сетка, кубики, туман, id, цвета
│   └── ui/                  # Konva-канвас, плавающие панели, чат, кубики, иконки
└── scripts/                 # интеграционный тест сервера
```

## Требования

- Node.js >= 20.19 (проверено на v24)
- npm (в PowerShell с запретом скриптов используйте `npm.cmd`)

## Установка и запуск

```powershell
npm install

# терминал 1: хост Мастера (Electron + Socket.io на :3001)
npm run dev:host

# терминал 2: веб-клиент игроков (Vite, http://localhost:5173)
npm run dev:client
```

В окне Мастера: создайте сессию → откройте её → панель «Приглашение» даст ссылку
`http://localhost:5173/?session=<id>` (в dev-режиме) или `http://<LAN-IP>:3001/?session=<id>`
(если собран веб-клиент — см. ниже).

### Сборка и режим «один порт»

```powershell
npm run build      # собирает desktop-host (out/) и web-client (dist/)
npm run dev:host   # хост найдёт web-client/dist и будет раздавать его на :3001
```

После сборки ссылка-приглашение ведёт на тот же порт 3001 — удобно для туннеля
(наружу открывается один порт).

### Ярлык для запуска приложения

```powershell
npm run build      # один раз собрать приложение
npm run shortcut   # создать ярлык «VTT» на рабочем столе и в папке проекта
```

Ярлык запускает **собранное** приложение (без консоли и npm): скрытый PowerShell-скрипт
[launch-vtt.ps1](scripts/launch-vtt.ps1) проверяет наличие сборки (при необходимости собирает её),
убирает унаследованные переменные `ELECTRON_RUN_AS_NODE` / `CHROME_CRASHPAD_PIPE_NAME`
и открывает `desktop-host` в Electron.

> **Кириллица в пути.** Electron не стартует, если в пути к `electron.exe` есть не-ASCII
> символы (у нас это папка «Проект по умолчанию»). Поэтому лаунчер при первом запуске
> копирует Electron в ASCII-путь `%LOCALAPPDATA%\VTT\electron-<версия>` (≈250 МБ, пара секунд)
> и запускает уже оттуда — окно открывается нормально. Проект при этом может оставаться
> в папке с русским названием.

Если папка проекта переехала, ярлык нужно пересоздать: `npm run shortcut`.

- Лог запуска: `desktop-host\out\launcher.log`, вывод Electron — `desktop-host\out\electron.log`
  и `electron-error.log`.
- Повторный запуск ярлыка при уже открытом VTT просто фокусирует существующее окно.
- Запуск из консоли: `npm run start:host`. При кириллице в пути ему нужен ASCII-путь к Electron:
  `$env:ELECTRON_OVERRIDE_DIST_PATH="$env:LOCALAPPDATA\VTT\electron-45.2.1"; npm run start:host`
- Иконка приложения: [icon.ico](desktop-host/build/icon.ico) (генерируется `scripts/make-icon.py`).

## Ссылка-приглашение и туннель

Панель «Приглашение» показывает три адреса: локальный, по локальной сети и через туннель.
Ссылка-приглашение выбирается так: туннель → LAN → localhost.

- Кнопка **«Запустить туннель cloudflared»** поднимает quick-туннель
  `cloudflared tunnel --no-autoupdate --url http://localhost:3001` и подставляет полученный
  `https://*.trycloudflare.com` в ссылку. Требуется установленный `cloudflared` в PATH.
- Если `cloudflared` не установлен, вставьте адрес своего туннеля (ngrok, cloudflared,
  reverse-proxy) в поле «Сохранить» — ссылка будет сформирована с его учётом.
- Туннелировать нужно только порт **3001** (в собранном варианте он же отдаёт веб-клиент).

## Где хранятся данные

`<userData>/vtt-data/<sessionId>/session.json` и `<sessionId>/assets/*` — на Windows это
`%APPDATA%\desktop-host\vtt-data`. Изображения копируются в папку сессии, в JSON хранятся
относительные пути (уточнение 5). Путь можно переопределить переменной окружения
`VTT_DATA_DIR`, порт — `VTT_PORT`.

Автосохранение: изменения пишутся на диск с задержкой ~250 мс (атомарно, через `.tmp` + rename),
а также принудительно при закрытии приложения.

## Проверки

```powershell
npm run typecheck   # tsc strict во всех пакетах
npm run lint        # ESLint
npm run format      # Prettier
npm run build       # production-сборка
npm run test:server # интеграционный тест сервера (сессии, сокеты, токены, чат, кубики, туман, файлы)
```

`test:server` поднимает сервер на порту 3999, подключает socket.io-клиента и проверяет
вход в сессию, права (туман войны — только Мастер, скрытые токены не уходят игрокам),
перемещение токенов, чат, кубики, рисование, отдачу файлов и защиту от path traversal.

## Реализованные этапы

- [x] **Этап 1** — монорепозиторий, Electron + Socket.io, React + Vite, подключение клиента
- [x] **Этап 2** — CRUD сессий, JSON-хранилище, список сессий, ссылки-приглашения, туннель
- [x] **Этап 3** — карта (Konva), сетка квадраты/гексы/без, pan/zoom, независимая камера
- [x] **Этап 4** — токены: загрузка PNG, drag & drop, перемещение, размер, поворот,
      GM-only скрытие, синхронизация
- [x] **Этап 5** — туман войны (кисть/ластик/область) и рисование для всех участников
- [x] **Этап 6** — кубики d4–d100 с историей, чат с именем и временем
- [x] **Этап 7** — тёмная тема, плавающие перетаскиваемые панели, восстановление
      после обрыва связи, адаптивная раскладка

## Критерии приёмки v1.0

| Критерий                                          | Где реализовано                                        |
| ------------------------------------------------- | ------------------------------------------------------ |
| Мастер создаёт сессию и получает ссылку           | `SessionManagerScreen`, `InvitePanel`                  |
| Игрок подключается по ссылке в браузере           | `web-client` → `client:join`                           |
| Карта загружается и отображается                  | `MapPanel` → `addAsset` → `MapLayer`                   |
| Сетка переключается между квадратами и гексами    | `MapPanel`, `shared/ui/board/GridLayer`                |
| Токены добавляются, перемещаются, скрываются      | `TokenPanel`, `TokensLayer`, `server.ts`               |
| Туман войны работает и синхронизируется           | `FogLayer`, `fog:update`                               |
| Рисование доступно всем игрокам                   | `drawing:add`, `DrawingsLayer`                         |
| Кубики бросаются, результат виден всем            | `DicePanel`, `dice:roll`                               |
| Чат работает                                      | `ChatPanel`, `chat:message`                            |
| Состояние восстанавливается после переподключения | `useVttSocket`, `useCamera`, Zustand                   |
| Сессия автосохраняется и загружается позже        | `SessionManager.save`, восстановление последней сессии |

## WebSocket API

Сервер — источник истины: проверяет роли, ограничивает размеры данных и сохраняет изменения.

**Host → Client**

| Событие                      | Данные                                                  |
| ---------------------------- | ------------------------------------------------------- |
| `session:update`             | `Session` (без скрытых токенов)                         |
| `session:closed`             | `{ reason }`                                            |
| `players:update`             | `PlayerInfo[]`                                          |
| `token:add` / `token:remove` | `Token` / `{ tokenId }`                                 |
| `token:update`               | `{ tokenId, x?, y?, width?, height?, rotation? }`       |
| `fog:update`                 | `FogOfWarData`                                          |
| `drawing:add`                | `Drawing`                                               |
| `chat:message`               | `{ userId, userName, text, timestamp }`                 |
| `dice:roll`                  | `{ userId, userName, dice, results, total, timestamp }` |
| `error:message`              | `{ message }`                                           |

**Client → Host**

| Событие                       | Данные                                                      |
| ----------------------------- | ----------------------------------------------------------- |
| `client:join`                 | `{ sessionId, playerName }` + ack `{ ok, players, error? }` |
| `session:request`             | —                                                           |
| `token:move` / `token:update` | `{ tokenId, x, y }` / `TokenPatch`                          |
| `chat:send`                   | `{ text }`                                                  |
| `dice:roll`                   | `{ dice: string[] }`                                        |
| `drawing:add`                 | `{ tool, color, size, points }`                             |
| `fog:update`                  | `FogOfWarData` (только роль GM)                             |

## Формат JSON сессии

```jsonc
{
  "schemaVersion": 1,
  "id": "a1b2c3d4e5",
  "name": "Проклятые земли",
  "description": "Кампания по D&D 5e",
  "createdAt": 1760000000000,
  "updatedAt": 1760000000000,
  "map": { "imageUrl": "assets/map-xxxx.png", "width": 4096, "height": 3072 },
  "tokens": [
    {
      "id": "tok_…",
      "name": "Гоблин",
      "imageUrl": "assets/token-yyyy.png",
      "x": 512,
      "y": 384,
      "width": 70,
      "height": 70,
      "rotation": 0,
      "hidden": false,
      "locked": false
    }
  ],
  "fogOfWar": {
    "covered": true,
    "ops": [
      {
        "id": "fog_…",
        "op": "reveal",
        "shape": "rect",
        "x": 0,
        "y": 0,
        "width": 400,
        "height": 300
      },
      { "id": "fog_…", "op": "conceal", "shape": "stroke", "points": [10, 10, 80, 90], "size": 140 }
    ]
  },
  "drawings": [
    {
      "id": "drw_…",
      "tool": "pencil",
      "color": "#38bdf8",
      "size": 4,
      "points": [10, 10, 80, 60],
      "authorId": "…",
      "authorName": "Тарвин",
      "createdAt": 1760000000000
    }
  ],
  "settings": { "gridType": "square", "gridSize": 70, "showGrid": true },
  "chatLog": [
    {
      "id": "msg_…",
      "userId": "…",
      "userName": "Тарвин",
      "text": "Привет",
      "timestamp": 1760000000000
    }
  ],
  "rollLog": [
    {
      "id": "roll_…",
      "userId": "…",
      "userName": "Тарвин",
      "dice": ["d20"],
      "results": [17],
      "total": 17,
      "timestamp": 1760000000000
    }
  ]
}
```

## Уточнения из ТЗ, учтённые в реализации

1. **Туннель.** `cloudflared` запускается из панели приглашения; можно вставить готовый адрес
   туннеля вручную.
2. **Камера.** Позиция и масштаб хранятся в `localStorage` каждого клиента
   (`vtt.camera.*`) и не синхронизируются.
3. **Типы данных.** `Token`, `FogOfWarData`, `Drawing`, `DrawingInput`, `TokenPatch`,
   `PlayerInfo` спроектированы и описаны в `shared/types`.
4. **Токены.** Перемещение и изменение размера доступны и Мастеру, и игрокам;
   закреплённый токен (`locked`) двигать нельзя.
5. **Изображения.** Копируются в `<session>/assets/`, в JSON — относительные пути.
6. **Приватных сообщений нет** — только общий чат.
7. **Роли.** GM — только хост через Electron; все веб-клиенты — игроки. GM-only действия
   (туман войны, скрытие и добавление токенов, настройки сессии) выполняются через IPC
   главного процесса, а сервер проверяет роль на сокете.
8. **Репозиторий.** `desktop-host/`, `web-client/` и `shared/` лежат в корне.

## Решения по реализации

- **Общий канвас.** Konva-компоненты, панели чата/кубиков и плавающие окна вынесены в
  `shared/ui`, поэтому Мастер и игроки видят одинаковую картинку и поведение.
- **Туман войны** хранится как список операций над базовым состоянием (`covered`),
  а не как пиксельная маска: JSON остаётся компактным, операции обратимы.
- **Ластик рисования** — линия с `globalCompositeOperation: destination-out` в отдельном
  слое: он стирает только рисунки, не карту и не токены.
- **Производительность.** Сетка рисуется одним `Shape` с отсечением по видимой области;
  перемещение токена рассылается точечным `token:update` (не полным состоянием), а полная
  рассылка `session:update` используется для структурных изменений.
- **Отключения.** Socket.io переподключается сам; клиент повторно входит в сессию,
  камера и инструменты восстанавливаются, состояние стола остаётся на экране.

## Ограничения v1.0

- История чата и бросков ограничена (500 сообщений / 200 бросков) и хранится в JSON сессии.
- Токены — квадратные изображения со скруглением; анимированные GIF не поддерживаются.
- Для гексов размер ячейки трактуется как ширина гекса.
- Масштаб камеры ограничен 5%…800%.

## Возможные проблемы

- **`npm` не запускается в PowerShell** — политика выполнения скриптов: используйте `npm.cmd`.
- **`Electron uninstall` при `npm run dev:host`** — не скачался бинарник Electron:
  `node node_modules/electron/install.js`.
- **`Cannot read properties of undefined (reading 'requestSingleInstanceLock')`** —
  в окружении задана переменная `ELECTRON_RUN_AS_NODE=1`, и Electron запускается как Node.
  Ярлык убирает её сам; при запуске из консоли удалите вручную:
  `Remove-Item Env:ELECTRON_RUN_AS_NODE`.
- **Ярлык запускается, но окно не появляется** — почти всегда кириллица в пути к проекту:
  Chromium/Electron падает ещё до запуска JS. Лаунчер обходит это, копируя Electron
  в `%LOCALAPPDATA%\VTT\electron-<версия>`; проверьте `desktop-host\out\launcher.log`.
  Если проект переносили — пересоздайте ярлык командой `npm run shortcut`.
- **`npm run dev:host` / `npm run start:host` падают сразу** — тот же путь с кириллицей.
  Задайте ASCII-путь к Electron:
  `$env:ELECTRON_OVERRIDE_DIST_PATH="$env:LOCALAPPDATA\VTT\electron-45.2.1"`.
- **Порт 3001 занят** — задайте другой: `$env:VTT_PORT=3010; npm run dev:host`
  (и укажите этот порт в `web-client/.env.local` как `VITE_HOST_URL=http://localhost:3010`).
- **Игроки не подключаются по LAN** — разрешите Node/Electron входящие подключения
  в брандмауэре Windows для порта 3001.
