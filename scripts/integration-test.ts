/* Интеграционный тест сервера VTT: сессии, сокеты, токены, чат, кубики, туман, файлы */
import { rm, writeFile } from 'node:fs/promises'
import { io, type Socket } from 'socket.io-client'
import type {
  ClientToServerEvents,
  CombatState,
  MapText,
  Note,
  ServerToClientEvents,
  Session,
  Token
} from '@vtt/shared'
import { flDieSuccesses, layoutMaps, newId, pushFlRoll, rollFlPool, stepTurn } from '@vtt/shared/utils'
import { BUILT_IN_EXTENSIONS, EXTENSION_CATEGORIES } from '@vtt/shared/plugins'
import type { HostServerEvent } from '../desktop-host/src/shared/ipc'
import { SessionManager } from '../desktop-host/src/main/session'
import { startVttServer } from '../desktop-host/src/main/server'
import { normalizeSession, SessionStorage } from '../desktop-host/src/main/storage'
import { mergeWithBaseline } from '../shared/ui/extensionState'
import { FIELDS as AZAG_FIELDS } from '../desktop-host/extensions/azag-sheet/fields.generated.js'

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
    extensionsDir: `${process.cwd()}/desktop-host/extensions`,
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
  check(session.schemaVersion === 2, 'у сессии выставлена версия схемы 2')
  check(session.maps.length === 0, 'новая сессия без карт')
  check(session.settings.gridType === 'square', 'настройки сетки по умолчанию')
  check((await manager.list()).length === 1, 'список сессий содержит созданную')

  const legacy = normalizeSession(
    {
      schemaVersion: 1,
      id: 'legacy',
      name: 'Старая сессия',
      map: { imageUrl: 'assets/old.png', width: 640, height: 480 }
    },
    'legacy'
  )
  check(
    legacy.schemaVersion === 2 && legacy.maps.length === 1 && legacy.maps[0]?.width === 640,
    'миграция v1: одна карта превращается в maps'
  )
  check(
    legacy.enabledExtensions['chat'] === true && legacy.enabledExtensions['troika-sheet'] === false,
    'у старой сессии появляются значения расширений по умолчанию'
  )
  check(
    session.enabledExtensions['chat'] === true &&
      session.enabledExtensions['troika-initiative'] === false,
    'включённость расширений хранится в сессии'
  )

  // Независимое редактирование листов: правки разных персонажей не затираются
  const mergedChars = mergeWithBaseline(
    {
      currentId: 'a',
      chars: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' }
      ]
    },
    {
      currentId: 'a',
      chars: [
        { id: 'a', name: 'A2' },
        { id: 'b', name: 'B' }
      ]
    },
    {
      currentId: 'b',
      chars: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B2' },
        { id: 'c', name: 'C' }
      ]
    },
    'chars'
  ) as { chars: Array<{ id: string; name: string }> }
  check(
    mergedChars.chars.find((item) => item.id === 'a')?.name === 'A2' &&
      mergedChars.chars.find((item) => item.id === 'b')?.name === 'B2' &&
      mergedChars.chars.some((item) => item.id === 'c'),
    'правки разных листов объединяются без потерь'
  )

  const categories = new Set(EXTENSION_CATEGORIES.map((category) => category.id))
  check(
    EXTENSION_CATEGORIES.some((category) => category.id === 'troika') &&
      BUILT_IN_EXTENSIONS.every((definition) => categories.has(definition.category ?? 'basic')),
    'все расширения разложены по разделам каталога'
  )
  check(
    AZAG_FIELDS.length === 61 &&
      AZAG_FIELDS.filter((field) => field.kind === 'checkbox').length === 3,
    'лист AZAG: 61 поле формы, включая 3 чекбокса'
  )

  const layout = layoutMaps([
    { id: 'a', imageUrl: 'a.png', width: 100, height: 50 },
    { id: 'b', imageUrl: 'b.png', width: 200, height: 80 }
  ])
  check(
    layout.items[1]?.x === 220 && layout.world.width === 420 && layout.world.height === 80,
    'карты раскладываются с зазором 120 px'
  )

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
    locked: false,
    stats: { hp: 10, hpMax: 20, tempHp: 2, ac: 14, visibility: 'full' },
    conditions: ['poisoned']
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

  const extensionPromise = watch<{ extensionId: string; state: unknown }>(
    client,
    'extension:update'
  )
  manager.updateSilent((current) => {
    current.extensionState = {
      ...current.extensionState,
      'troika-initiative': { round: 3, draw: 'END' }
    }
  })
  server.extensionUpdated('troika-initiative', { round: 3, draw: 'END' })
  const extensionUpdate = await extensionPromise
  check(
    extensionUpdate.extensionId === 'troika-initiative' &&
      (extensionUpdate.state as { round: number }).round === 3,
    'состояние расширения доставляется игрокам'
  )

  const appResponse = await fetch(`http://localhost:${PORT}/extensions/troika-initiative/app.js`)
  const appSource = await appResponse.text()
  check(appResponse.status === 200, 'исходный app.js расширения отдаётся по HTTP')
  check(
    appSource.includes('/extensions/troika-initiative/obr-shim.js') &&
      !appSource.includes('cdn.jsdelivr.net/npm/@owlbear-rodeo'),
    'в отдаваемом app.js SDK заменён на локальный адаптер (исходник не изменён)'
  )
  const shimResponse = await fetch(
    `http://localhost:${PORT}/extensions/troika-initiative/obr-shim.js`
  )
  check(shimResponse.status === 200, 'адаптер OBR SDK доступен')
  const traversalResponse = await fetch(
    `http://localhost:${PORT}/extensions/..%2F..%2Fpackage.json`
  )
  check(
    traversalResponse.status === 403 || traversalResponse.status === 404,
    'выход за папку расширений заблокирован'
  )

  const sheetApp = await fetch(`http://localhost:${PORT}/extensions/troika-sheet/app.js`)
  const sheetSource = await sheetApp.text()
  check(
    sheetApp.status === 200 &&
      sheetSource.includes('/extensions/troika-sheet/obr-shim.js') &&
      !sheetSource.includes('cdn.jsdelivr.net/npm/@owlbear-rodeo'),
    'лист персонажа отдаётся с локальным адаптером SDK'
  )

  const sheetIndex = await fetch(`http://localhost:${PORT}/extensions/troika-sheet/index.html`)
  const sheetHtml = await sheetIndex.text()
  check(
    sheetIndex.status === 200 &&
      sheetHtml.includes('id="vtt-adapter"') &&
      sheetHtml.includes('#btnPublish') &&
      !sheetHtml.includes('cdn.jsdelivr.net'),
    'в отдаваемом index.html листа скрыты лишние кнопки (исходник не изменён)'
  )

  const azagApp = await fetch(`http://localhost:${PORT}/extensions/azag-sheet/app.js`)
  const azagSource = await azagApp.text()
  check(
    azagApp.status === 200 &&
      azagSource.includes('/extensions/azag-sheet/obr-shim.js') &&
      !azagSource.includes('cdn.jsdelivr.net'),
    'лист AZAG отдаётся с локальным адаптером SDK'
  )
  const azagFields = await fetch(
    `http://localhost:${PORT}/extensions/azag-sheet/fields.generated.js`
  )
  check(azagFields.status === 200, 'данные полей листа AZAG доступны')
  const azagSheet = await fetch(`http://localhost:${PORT}/extensions/azag-sheet/sheet.png`)
  check(azagSheet.status === 200, 'фон листа AZAG доступен')

  const dice3dPage = await fetch(`http://localhost:${PORT}/extensions/dice3d/index.html`)
  const dice3dHtml = await dice3dPage.text()
  check(
    dice3dPage.status === 200 && dice3dHtml.includes('dice-box-threejs.umd.js'),
    'страница 3D-кубиков доступна'
  )
  const dice3dBundle = await fetch(
    `http://localhost:${PORT}/extensions/dice3d/dice-box-threejs.umd.js`
  )
  const dice3dBundleBody = await dice3dBundle.arrayBuffer()
  check(
    dice3dBundle.status === 200 && dice3dBundleBody.byteLength > 400_000,
    'движок 3D-кубиков лежит локально (без CDN)'
  )
  const dice3dTexture = await fetch(
    `http://localhost:${PORT}/extensions/dice3d/assets/textures/astral.webp`
  )
  check(dice3dTexture.status === 200, 'текстуры 3D-кубиков доступны')
  const dice3dApp = await fetch(`http://localhost:${PORT}/extensions/dice3d/app.js`)
  const dice3dSource = await dice3dApp.text()
  check(
    dice3dApp.status === 200 && dice3dSource.includes("type: 'chat'"),
    '3D-кубики умеют отправлять результат в чат'
  )

  const azagUpdatePromise = watch<{ extensionId: string; state: unknown }>(
    client,
    'extension:update'
  )
  client.emit('extension:update', {
    extensionId: 'azag-sheet',
    state: { currentId: 'c1', chars: [{ id: 'c1', fields: { 'chr name': 'Азаг' } }] }
  })
  const azagUpdate = await azagUpdatePromise
  check(
    azagUpdate.extensionId === 'azag-sheet' &&
      Array.isArray((azagUpdate.state as { chars?: unknown[] }).chars),
    'игрок может сохранить лист AZAG'
  )

  // Лист персонажа может сохранять любой игрок
  const sheetPromise = watch<{ extensionId: string; state: unknown }>(client, 'extension:update')
  client.emit('extension:update', {
    extensionId: 'troika-sheet',
    state: { chars: [{ id: 'c1', fields: { name: 'Тарвин' } }] }
  })
  const sheetUpdate = await sheetPromise
  check(
    sheetUpdate.extensionId === 'troika-sheet' &&
      Array.isArray((sheetUpdate.state as { chars?: unknown[] }).chars),
    'игрок может сохранить лист персонажа (общее состояние)'
  )

  // В модуль инициативы игрок писать не может
  let forbiddenUpdate = false
  const onForbidden = (): void => {
    forbiddenUpdate = true
  }
  client.once('extension:update', onForbidden)
  client.emit('extension:update', {
    extensionId: 'troika-initiative',
    state: { round: 99 }
  })
  await new Promise((resolve) => setTimeout(resolve, 300))
  client.off('extension:update', onForbidden)
  check(!forbiddenUpdate, 'в GM-модуль инициативы игрок записать не может')

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

  // Статы: игроки получают цифры только в режиме full
  const fullStatsSession = await (async () => {
    const promise = watch<Session>(client, 'session:update')
    manager.update((current) => {
      const item = current.tokens.find((entry) => entry.id === token.id)
      if (item) item.stats = { hp: 10, hpMax: 20, tempHp: 4, ac: 14, visibility: 'full' }
    })
    return promise
  })()
  const fullToken = fullStatsSession.tokens.find((entry) => entry.id === token.id)
  check(
    fullToken?.stats?.hp === 10 && fullToken.stats.hpMax === 20,
    'при режиме full игрок видит цифры статов'
  )

  const barStatsPromise = watch<Session>(client, 'session:update')
  manager.update((current) => {
    const item = current.tokens.find((entry) => entry.id === token.id)
    if (item) item.stats = { hp: 10, hpMax: 20, tempHp: 4, ac: 14, visibility: 'bar' }
  })
  const barSession = await barStatsPromise
  const barToken = barSession.tokens.find((entry) => entry.id === token.id)
  check(
    barToken?.stats === null && barToken.hpPercent === 0.5,
    'при режиме bar игрок получает только долю HP'
  )

  const hiddenStatsPromise = watch<Session>(client, 'session:update')
  manager.update((current) => {
    const item = current.tokens.find((entry) => entry.id === token.id)
    if (item) item.stats = { hp: 10, hpMax: 20, tempHp: 4, ac: 14, visibility: 'hidden' }
  })
  const hiddenStatsSession = await hiddenStatsPromise
  const hiddenStatsToken = hiddenStatsSession.tokens.find((entry) => entry.id === token.id)
  check(
    hiddenStatsToken?.stats === null && hiddenStatsToken.hpPercent === undefined,
    'при режиме hidden цифры статов не утекают игроку'
  )

  // Игрок не может менять статы через сокет
  client.emit('token:update', {
    tokenId: token.id,
    stats: { hp: 999, hpMax: 999, tempHp: 0, ac: 99, visibility: 'full' }
  })
  await new Promise((resolve) => setTimeout(resolve, 250))
  const afterPlayerPatch = manager.getActive()?.tokens.find((entry) => entry.id === token.id)
  check(
    afterPlayerPatch?.stats?.hp === 10 && afterPlayerPatch.stats.visibility === 'hidden',
    'игрок не может изменить статы токена'
  )

  // Бой: скрытые бойцы не уходят игрокам
  const visibleCombatant = {
    id: 'cb-visible',
    tokenId: token.id,
    name: 'Гоблин',
    initiative: 15,
    bonus: 2,
    tiebreak: 1,
    hidden: false,
    defeated: false
  }
  const secretCombatant = {
    id: 'cb-secret',
    tokenId: hidden.id,
    name: 'Секретный враг',
    initiative: 20,
    bonus: 0,
    tiebreak: 2,
    hidden: true,
    defeated: false
  }
  const combat: CombatState = {
    active: true,
    round: 1,
    turnId: visibleCombatant.id,
    order: [secretCombatant.id, visibleCombatant.id],
    combatants: [visibleCombatant, secretCombatant],
    announce: true,
    updatedAt: Date.now()
  }

  const combatSessionPromise = watch<Session>(client, 'session:update')
  manager.update((current) => {
    current.combat = combat
  })
  const combatSession = await combatSessionPromise
  check(
    combatSession.combat?.combatants.length === 1 &&
      combatSession.combat.combatants[0]?.id === visibleCombatant.id,
    'скрытый боец не попадает игрокам'
  )

  const hiddenTurn = { ...combat, turnId: secretCombatant.id }
  const hiddenTurnPromise = watch<Session>(client, 'session:update')
  manager.update((current) => {
    current.combat = hiddenTurn
  })
  const hiddenTurnSession = await hiddenTurnPromise
  check(
    hiddenTurnSession.combat?.turnId === null && hiddenTurnSession.combat.turnHidden === true,
    'скрытый текущий ход показывается игроку как «Ход Мастера»'
  )

  const nextCombat = stepTurn({ ...combat, turnId: combat.order[1]! }, 1)
  check(
    nextCombat.round === 2 && nextCombat.turnId === combat.order[0],
    'раунд переключается по кругу'
  )

  // Текст на карте: добавление, правка и удаление игроком
  const textPromise = watch<MapText>(client, 'text:add')
  client.emit('text:add', {
    x: 100,
    y: 120,
    text: 'Заметка на карте',
    color: '#f8fafc',
    fontSize: 26
  })
  const mapText = await textPromise
  check(
    mapText.text === 'Заметка на карте' && mapText.fontSize === 26,
    'текст на карте добавлен и разослан'
  )

  const textUpdatePromise = watch<MapText>(client, 'text:update')
  client.emit('text:update', { textId: mapText.id, x: 150, y: 160, text: 'Новая заметка' })
  const updatedText = await textUpdatePromise
  check(
    updatedText.text === 'Новая заметка' && updatedText.x === 150,
    'текст на карте можно переместить и изменить'
  )

  const textRemovePromise = watch<{ textId: string }>(client, 'text:remove')
  client.emit('text:remove', { textId: mapText.id })
  const removedText = await textRemovePromise
  check(removedText.textId === mapText.id, 'текст на карте удаляется')

  // Цвета сетки/имён и скрытие имени токена
  const stylingPromise = watch<Session>(client, 'session:update')
  manager.update((current) => {
    current.settings.gridColor = '#ff0000'
    current.settings.tokenLabelColor = '#00ff00'
    current.settings.showTokenNames = false
    const item = current.tokens.find((entry) => entry.id === token.id)
    if (item) item.hideName = true
  })
  const styling = await stylingPromise
  check(
    styling.settings.gridColor === '#ff0000' &&
      styling.settings.tokenLabelColor === '#00ff00' &&
      styling.settings.showTokenNames === false,
    'цвет сетки, цвет имён и глобальное скрытие имён сохраняются'
  )
  check(
    styling.tokens.find((entry) => entry.id === token.id)?.hideName === true,
    'имя отдельного токена скрывается'
  )

  client.emit('token:update', { tokenId: token.id, hideName: false })
  await new Promise((resolve) => setTimeout(resolve, 200))
  check(
    manager.getActive()?.tokens.find((entry) => entry.id === token.id)?.hideName === true,
    'игрок не может менять скрытие имени токена'
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
    current.maps = [{ id: newId('map'), imageUrl: asset!.relativePath, width: 1, height: 1 }]
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

  const pdfSource = '.tmp/test-pdf-source.pdf'
  await writeFile(
    pdfSource,
    Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n', 'utf8')
  )
  const pdf = await manager.addPdf(pdfSource, 'test.pdf')
  check(
    pdf !== null && manager.getActive()?.pdfs.some((item) => item.id === pdf?.id) === true,
    'PDF добавлен в библиотеку'
  )
  const pdfResponse = await fetch(
    `http://localhost:${PORT}/session-assets/${session.id}/${pdf!.relativePath}`
  )
  check(
    pdfResponse.status === 200 && pdfResponse.headers.get('content-type') === 'application/pdf',
    'PDF отдаётся с правильным Content-Type'
  )
  const rangeResponse = await fetch(
    `http://localhost:${PORT}/session-assets/${session.id}/${pdf!.relativePath}`,
    { headers: { Range: 'bytes=0-9' } }
  )
  check(
    rangeResponse.status === 206 &&
      (rangeResponse.headers.get('content-range') ?? '').startsWith('bytes 0-9/'),
    'PDF поддерживает Range-запросы'
  )
  check(await manager.removePdf(pdf!.id), 'PDF удаляется из библиотеки')
  await rm(pdfSource, { force: true })

  const notePromise = watch<Note>(client, 'note:add')
  client.emit('note:add', {
    title: 'Общая заметка',
    body: '# Журнал\n\nТекст',
    tags: ['журнал'],
    visibility: 'shared'
  })
  const sharedNote = await notePromise
  check(
    sharedNote.title === 'Общая заметка' && sharedNote.visibility === 'shared',
    'игрок создаёт общую заметку'
  )

  const gmNoteSessionPromise = watch<Session>(client, 'session:update')
  manager.update((current) => {
    current.notes.push({
      id: newId('note'),
      title: 'Секрет Мастера',
      body: 'Не показывать игрокам',
      authorId: 'gm',
      authorName: 'Мастер',
      visibility: 'gm',
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    })
  })
  const gmNoteSession = await gmNoteSessionPromise
  check(
    gmNoteSession.notes.every((note) => note.visibility !== 'gm'),
    'GM-заметки не попадают игрокам'
  )

  const noteUpdatePromise = watch<Note>(client, 'note:update')
  client.emit('note:update', { noteId: sharedNote.id, title: 'Обновлённая заметка' })
  const updatedNote = await noteUpdatePromise
  check(updatedNote.title === 'Обновлённая заметка', 'общую заметку можно обновить')

  const noteRemovePromise = watch<{ noteId: string }>(client, 'note:remove')
  client.emit('note:remove', { noteId: sharedNote.id })
  check((await noteRemovePromise).noteId === sharedNote.id, 'общую заметку можно удалить')

  client.emit('note:add', {
    title: 'Игрок пытается создать секрет',
    body: 'не должно сохраниться',
    tags: [],
    visibility: 'gm'
  })
  await new Promise((resolve) => setTimeout(resolve, 200))
  check(
    !manager.getActive()?.notes.some((note) => note.title === 'Игрок пытается создать секрет'),
    'игрок не может создать GM-заметку'
  )

  // Кубы Forbidden Lands: успехи, баны по цветам, push и минус-кубы
  const sequence = (values: number[]) => {
    let index = 0
    return () => {
      const value = values[index++] ?? 6
      return (value - 1) / 6 + 0.001
    }
  }
  const flRoll = rollFlPool({ base: 2, skill: 1, gear: 1 }, sequence([6, 1, 6, 1]))
  check(
    flRoll.successes === 2 && flRoll.baseBanes === 1 && flRoll.gearBanes === 1,
    'кубы FL: успехи и баны считаются по цветам'
  )
  const flPush = pushFlRoll(
    { base: 1, skill: 1, gear: 0 },
    rollFlPool({ base: 1, skill: 1, gear: 0 }, sequence([2, 1])),
    sequence([6, 6])
  )
  check(
    flPush.successes === 2 && flPush.baseBanes === 0 && flPush.skillBanes === 0 && flPush.pushed,
    'кубы FL: риск перебрасывает и 1 на красных'
  )
  const flRedOne = rollFlPool({ base: 0, skill: 1, gear: 0 }, sequence([1]))
  check(
    flRedOne.successes === 0 && flRedOne.skillBanes === 0,
    'кубы FL: 1 на красном кубе — не бан'
  )
  const flExtra = rollFlPool(
    { base: 0, skill: 0, gear: 0, d8: 1, d10: 1, d12: 1 },
    sequence([1, 1, 1])
  )
  const flExtraMax = rollFlPool(
    { base: 0, skill: 0, gear: 0, d8: 1, d10: 1, d12: 1 },
    () => 0.99
  )
  const flThresholds =
    flDieSuccesses({ type: 'd8', value: 6 }) === 1 &&
    flDieSuccesses({ type: 'd8', value: 8 }) === 2 &&
    flDieSuccesses({ type: 'd10', value: 7 }) === 1 &&
    flDieSuccesses({ type: 'd10', value: 9 }) === 2 &&
    flDieSuccesses({ type: 'd10', value: 10 }) === 3 &&
    flDieSuccesses({ type: 'd12', value: 8 }) === 2 &&
    flDieSuccesses({ type: 'd12', value: 10 }) === 3 &&
    flDieSuccesses({ type: 'd12', value: 12 }) === 4
  check(
    flExtra.successes === 0 &&
      flExtra.baseBanes === 0 &&
      flExtraMax.successes === 9 &&
      flExtraMax.dice.length === 3 &&
      flThresholds,
    'кубы FL: d8/d10/d12 дают 1–4 успеха и не дают бан за 1'
  )
  const flNegative = rollFlPool(
    { base: 0, skill: 1, gear: 0, modifier: -1 },
    sequence([6, 6])
  )
  check(flNegative.successes === 0, 'кубы FL: минус-куб вычитает успех')

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
