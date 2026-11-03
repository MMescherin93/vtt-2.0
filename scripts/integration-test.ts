/* Интеграционный тест сервера VTT: сессии, сокеты, токены, чат, кубики, туман, файлы */
import { rm } from 'node:fs/promises'
import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents, Session, Token } from '@vtt/shared'
import { newId } from '@vtt/shared/utils'
import type { HostServerEvent } from '../desktop-host/src/shared/ipc'
import { SessionManager } from '../desktop-host/src/main/session'
import { startVttServer } from '../desktop-host/src/main/server'
import { SessionStorage } from '../desktop-host/src/main/storage'

const PORT = Number(process.env.VTT_TEST_PORT ?? 3999)
const DATA_DIR = '.tmp/test-data'

let failures = 0
function check(condition: unknown, message: string): void {
  if (condition) {
    console.log(`  ok  ${message}`)
  } else {
    failures += 1
    console.error(`  FAIL ${message}`)
  }
}

type Client = Socket<ServerToClientEvents, ClientToServerEvents>

/** Подписка на событие ДО действия, которое его вызывает (без гонок) */
function watch<T>(socket: Client, event: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`таймаут события ${event}`)), 4000)
    socket.once(
      event as never,
      ((payload: T) => {
        clearTimeout(timer)
        resolve(payload)
      }) as never
    )
  })
}

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

async function main(): Promise<void> {
  await rm(DATA_DIR, { recursive: true, force: true })
  const storage = new SessionStorage(DATA_DIR)
  await storage.ensureRoot()
  const manager = new SessionManager(storage, 10)

  const hostEvents: HostServerEvent[] = []
  const server = startVttServer({
    port: PORT,
    clientPort: PORT,
    clientDistDir: null,
    sessionManager: manager,
    storage,
    onStatusChange: () => undefined,
    onHostEvent: (event) => hostEvents.push(event)
  })
  manager.onChange = (session) => {
    if (session) server.broadcastSession(session)
  }

  const session = await manager.create('Проклятые земли', 'Тестовая сессия')
  check(session.id.length > 0, 'сессия создана')
  check(session.schemaVersion === 1, 'у сессии выставлена версия схемы')
  check(session.settings.gridType === 'square', 'настройки сетки по умолчанию')
  check((await manager.list()).length === 1, 'список сессий содержит созданную')

  const client: Client = io(`http://localhost:${PORT}`, { transports: ['websocket'] })
  await new Promise<void>((resolve, reject) => {
    client.on('connect', () => resolve())
    client.on('connect_error', (error) => reject(error))
    setTimeout(() => reject(new Error('не удалось подключиться к серверу')), 5000)
  })

  const firstSession = watch<Session>(client, 'session:update')
  const join = await new Promise<{ ok: boolean; players: number; error?: string }>((resolve) => {
    client.emit('client:join', { sessionId: session.id, playerName: 'Тарвин' }, resolve)
  })
  check(join.ok, 'игрок вошёл в сессию')
  check(join.players === 1, 'сервер считает игрока подключённым')

  const sessionUpdate = await firstSession
  check(sessionUpdate.id === session.id, 'игрок получил состояние сессии')
  check(sessionUpdate.tokens.length === 0, 'новых токенов нет')

  const requested = watch<Session>(client, 'session:update')
  client.emit('session:request')
  check((await requested).id === session.id, 'session:request возвращает состояние')

  const token: Token = {
    id: newId('tok'),
    name: 'Гоблин',
    imageUrl: '',
    x: 120,
    y: 140,
    width: 70,
    height: 70,
    rotation: 0,
    hidden: false,
    locked: false
  }
  const addedPromise = watch<Token>(client, 'token:add')
  manager.update((current) => {
    current.tokens.push(token)
  })
  server.tokenAdded(token)
  const added = await addedPromise
  check(added.id === token.id, 'токен разослан игрокам (token:add)')

  const movedPromise = watch<{ tokenId: string; x?: number }>(client, 'token:update')
  client.emit('token:update', { tokenId: token.id, x: 300, y: 220, rotation: 15 })
  const movedPatch = await movedPromise
  check(
    movedPatch.tokenId === token.id && movedPatch.x === 300,
    'перемещение токена синхронизировано'
  )
  check(manager.getActive()?.tokens[0]?.x === 300, 'сервер сохранил позицию токена')
  check(
    hostEvents.some((event) => event.type === 'token:update'),
    'хост получил событие token:update'
  )

  const chatPromise = watch<{ text: string; userName: string }>(client, 'chat:message')
  client.emit('chat:send', { text: 'Привет, стол!' })
  const chat = await chatPromise
  check(chat.text === 'Привет, стол!', 'чат доставлен')
  check(chat.userName === 'Тарвин', 'в сообщении есть имя отправителя')

  const rollPromise = watch<{ results: number[]; total: number }>(client, 'dice:roll')
  client.emit('dice:roll', { dice: ['d20', 'd6'] })
  const roll = await rollPromise
  check(roll.results.length === 2, 'кубики брошены (два результата)')
  check(roll.total === roll.results[0]! + roll.results[1]!, 'сумма броска корректна')

  const drawingPromise = watch<{ authorName: string; points: number[] }>(client, 'drawing:add')
  client.emit('drawing:add', {
    tool: 'pencil',
    color: '#38bdf8',
    size: 4,
    points: [10, 10, 80, 60]
  })
  const drawing = await drawingPromise
  check(drawing.points.length === 4, 'рисунок синхронизирован')
  check(drawing.authorName === 'Тарвин', 'у рисунка есть автор')

  const fogErrorPromise = watch<{ message: string }>(client, 'error:message')
  client.emit('fog:update', { covered: false, ops: [] })
  const fogError = await fogErrorPromise
  check(fogError.message.includes('Мастер'), 'игроку запрещено менять туман войны')

  const hidden: Token = { ...token, id: newId('tok'), name: 'Скрытый', hidden: true }
  const hiddenSessionPromise = watch<Session>(client, 'session:update')
  manager.update((current) => {
    current.tokens.push(hidden)
  })
  const filtered = await hiddenSessionPromise
  check(
    filtered.tokens.every((item) => !item.hidden),
    'скрытый токен не попадает игрокам'
  )
  check(
    !hostEvents.some((event) => event.type === 'token:add' && event.token.hidden),
    'скрытый токен не уходит в token:add'
  )

  const fogPromise = watch<{ covered: boolean }>(client, 'fog:update')
  manager.update((current) => {
    current.fogOfWar = { covered: true, ops: [] }
  })
  server.fogUpdated({ covered: true, ops: [] })
  check((await fogPromise).covered === true, 'туман войны синхронизирован')

  const asset = await manager.addAsset('map.png', new Uint8Array(PNG_1X1), 'map')
  check(asset !== null && asset.width === 1 && asset.height === 1, 'размер картинки определён')
  manager.update((current) => {
    current.map = { imageUrl: asset!.relativePath, width: 1, height: 1 }
  })
  const assetResponse = await fetch(
    `http://localhost:${PORT}/session-assets/${session.id}/${asset!.relativePath}`
  )
  check(assetResponse.status === 200, 'изображение сессии доступно по HTTP')
  check(assetResponse.headers.get('content-type') === 'image/png', 'верный Content-Type картинки')
  const bytes = new Uint8Array(await assetResponse.arrayBuffer())
  check(bytes.byteLength === PNG_1X1.byteLength, 'файл отдан целиком')

  const traversal = await fetch(
    `http://localhost:${PORT}/session-assets/${session.id}/..%2F..%2Fsession.json`
  )
  check(traversal.status === 403 || traversal.status === 404, 'выход за папку сессии заблокирован')

  const health = await fetch(`http://localhost:${PORT}/api/health`)
  const healthBody = (await health.json()) as { ok: boolean; sessionId: string }
  check(healthBody.ok && healthBody.sessionId === session.id, 'health-endpoint сообщает сессию')

  await manager.flush()
  const saved = await storage.read(session.id)
  check(saved?.chatLog.length === 2, 'чат сохранён в JSON (сообщение + бросок)')
  check(
    saved?.chatLog.some((message) => message.text.includes('🎲')),
    'результат броска продублирован в чат'
  )
  check(saved?.rollLog.length === 1, 'история бросков сохранена')
  check(saved?.drawings.length === 1, 'рисунки сохранены')

  const closedPromise = watch<{ reason: string }>(client, 'session:closed')
  server.sessionClosed('Тест завершён')
  check((await closedPromise).reason === 'Тест завершён', 'игрок уведомлён о закрытии сессии')

  client.disconnect()
  await server.stop()
  await manager.remove(session.id)
  check((await manager.list()).length === 0, 'сессия удалена')

  console.log(failures === 0 ? '\nВсе проверки пройдены' : `\nПровалено проверок: ${failures}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
