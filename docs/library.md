# PDF-библиотека и заметки

Модули раздела **«Библиотека»**: `pdf-viewer` и `notes`.

## PDF-библиотека (`pdf-viewer`)

### Возможности

- Мастер загружает PDF через системный диалог; файл копируется в папку сессии.
- Все участники видят список документов и читают PDF.
- Просмотр через **PDF.js**: страницы, номер страницы, масштаб, «по ширине».
- Удаление документа Мастером (вместе с файлом).
- Раздача PDF по `/session-assets/<session>/assets/pdf-*.pdf` с `Content-Type:
application/pdf`, `Accept-Ranges: bytes` и поддержкой `Range` (206).
- Ограничение: 500 МБ на документ; хранение — в папке сессии, в JSON только
  метаданные.

### Модель

`Session.pdfs: PdfDocument[]`

```ts
interface PdfDocument {
  id: string
  title: string
  fileName: string
  relativePath: string
  size: number
  addedAt: number
  pages?: number
}
```

### Где код

- `shared/ui/panels/PdfViewer.tsx` — PDF.js-просмотрщик.
- `shared/ui/panels/PdfPanel.tsx` — список документов и панель.
- `desktop-host/src/main/session.ts` — `addPdf` / `removePdf`.
- `desktop-host/src/main/storage.ts` — копирование файла и удаление.
- `desktop-host/src/main/index.ts` — IPC `pdf:pick` / `pdf:remove`.
- `desktop-host/src/main/server.ts` — MIME `.pdf` и Range.

## Заметки (`notes`)

### Возможности

- **Общие** — журнал кампании, виден всем; правят все участники.
- **Мастер** — заметки только для Мастера; сервер не отдаёт их игрокам.
- **Мои** — личные заметки в `localStorage`, не уходят на сервер.
- Markdown и предпросмотр.
- Поиск по заголовку, тексту и тегам.
- Автосохранение общих заметок (задержка ~650 мс).
- Удаление: общие заметки может менять и удалять любой участник; личные — только
  локально.

### Модель

`Session.notes: Note[]` — только общие и GM-заметки.

```ts
interface Note {
  id: string
  title: string
  body: string // Markdown
  authorId: string
  authorName: string
  visibility: 'shared' | 'gm'
  tags: string[]
  createdAt: number
  updatedAt: number
  pdf?: { documentId: string; page: number }
}
```

«Мои» заметки хранятся в `localStorage` под ключом
`vtt.notes.<sessionId>.<ownerKey>`.

### Фильтрация

`playerSession()` в `desktop-host/src/main/server.ts` вырезает заметки
`visibility: 'gm'`. Сокетные обработчики `note:add/update/remove` не дают
игроку создавать или менять GM-заметки. GM-заметки не попадают в
`session:update` игроков.

### Где код

- `shared/ui/panels/NotesPanel.tsx` — панель, Markdown, локальные заметки.
- `shared/types/note.ts` — модель.
- `desktop-host/src/main/server.ts` — события и фильтрация.
- `desktop-host/src/main/index.ts` — IPC Мастера.
- `web-client/src/store/useClientStore.ts` / `useVttSocket.ts` — события игрока.

## Ограничения и дальнейшие шаги

- Ссылки из заметки на страницу PDF в модели уже есть (`Note.pdf`), UI-выбор
  документа/страницы — следующий шаг.
- Закрепление заметок на карте и аннотации PDF — позже.
- Приватные серверные заметки (синхронизация между устройствами) — отдельная
  задача; сейчас приватность обеспечивается локальным хранением.
