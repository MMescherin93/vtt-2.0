import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { Server } from 'socket.io'
import type { Socket } from 'socket.io'
import type {
  ChatMessage,
  ClientToServerEvents,
  DiceRoll,
  Drawing,
  FogOfWarData,
  PlayerInfo,
  ServerToClientEvents,
  Session,
  SocketData,
  Token,
  TokenPatch
} from '@vtt/shared'
import {
  MAX_CHAT_LOG,
  MAX_DICE_PER_ROLL,
  MAX_ROLL_LOG,
  colorForPlayer,
  diceSides,
  formatDice,
  newId,
  rollDice,
  sanitizeFog,
  trimLog
} from '@vtt/shared/utils'
import type { HostServerEvent, ServerStatus } from '../shared/ipc'
import { getLanIp } from './net'
import { SessionManager } from './session'
import { SessionStorage } from './storage'

type VttSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>

export interface VttServerOptions {
  port: number
  /** Порт, на котором открыт веб-клиент (3001, если хост раздаёт сборку) */
  clientPort: number
  /** Папка собранного веб-клиента (null — хост не раздаёт статику) */
  clientDistDir: string | null
  sessionManager: SessionManager
  storage: SessionStorage
  onStatusChange: (status: ServerStatus) => void
  onHostEvent: (event: HostServerEvent) => void
}

export interface VttServer {
  getStatus(): ServerStatus
  getPlayers(): PlayerInfo[]
  /** Полная рассылка состояния (после структурных изменений) */
  broadcastSession(session: Session | null): void
  tokenAdded(token: Token): void
  tokenUpdated(patch: TokenPatch): void
  tokenRemoved(tokenId: string): void
  fogUpdated(fog: FogOfWarData): void
  drawingAdded(drawing: Drawing): void
  chatMessage(message: ChatMessage): void
  diceRolled(roll: DiceRoll): void
  /** Сессия закрыта/удалена — игроки получают уведомление */
  sessionClosed(reason: string): void
  stop(): Promise<void>
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm'
}

function mimeFor(filePath: string): string {
  return MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function sanitizePlayerName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim().slice(0, 32) : ''
  return name || 'Игрок'
}

function sanitizeColor(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#f8fafc'
}

/** Игроки не должны получать скрытые токены (ТЗ, п.3: GM-only скрытие) */
function playerSession(session: Session): Session {
  return {
    ...session,
    tokens: session.tokens.filter((token) => !token.hidden)
  }
}

export function applyTokenPatch(session: Session, patch: TokenPatch): TokenPatch | null {
  const token = session.tokens.find((item) => item.id === patch.tokenId)
  if (!token) return null

  const maxX = session.map.width > 0 ? session.map.width : Number.POSITIVE_INFINITY
  const maxY = session.map.height > 0 ? session.map.height : Number.POSITIVE_INFINITY
  const result: TokenPatch = { tokenId: token.id }

  if (isFiniteNumber(patch.x)) {
    token.x = clamp(patch.x, 0, maxX)
    result.x = token.x
  }
  if (isFiniteNumber(patch.y)) {
    token.y = clamp(patch.y, 0, maxY)
    result.y = token.y
  }
  if (isFiniteNumber(patch.width)) {
    token.width = clamp(patch.width, 10, 5000)
    result.width = token.width
  }
  if (isFiniteNumber(patch.height)) {
    token.height = clamp(patch.height, 10, 5000)
    result.height = token.height
  }
  if (isFiniteNumber(patch.rotation)) {
    token.rotation = clamp(patch.rotation, -3600, 3600)
    result.rotation = token.rotation
  }
  return result
}

/**
 * Socket.io сервер (ТЗ: порт 3001) + HTTP-раздача веб-клиента и изображений
 * сессии. Сервер — источник истины: проверяет роли и сохраняет изменения.
 */
export function startVttServer(options: VttServerOptions): VttServer {
  const { port, clientPort, clientDistDir, sessionManager, storage, onStatusChange, onHostEvent } =
    options

  const lanIp = getLanIp()
  const servingClient = Boolean(clientDistDir)

  const status = (): ServerStatus => ({
    port,
    listening: httpServer.listening,
    clients: io.engine.clientsCount,
    lanIp,
    clientPort,
    servingClient
  })

  const notifyStatus = (): void => {
    onStatusChange(status())
  }

  async function serveFile(
    res: ServerResponse,
    filePath: string,
    cacheControl: string
  ): Promise<void> {
    const info = await stat(filePath)
    if (!info.isFile()) {
      res.writeHead(404)
      res.end('Not found')
      return
    }
    res.writeHead(200, {
      'Content-Type': mimeFor(filePath),
      'Content-Length': info.size,
      'Cache-Control': cacheControl,
      'Access-Control-Allow-Origin': '*'
    })
    createReadStream(filePath).pipe(res)
  }

  async function serveSessionAsset(
    res: ServerResponse,
    sessionId: string,
    relativePath: string
  ): Promise<void> {
    const filePath = storage.resolveAssetPath(sessionId, relativePath)
    if (!filePath) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }
    try {
      await serveFile(res, filePath, 'public, max-age=31536000, immutable')
    } catch {
      res.writeHead(404)
      res.end('Not found')
    }
  }

  async function serveClient(res: ServerResponse, pathname: string): Promise<void> {
    if (!clientDistDir) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>VTT — сервер Мастера</title></head>
<body style="background:#1a1a1a;color:#e5e7eb;font-family:system-ui,sans-serif;padding:40px;line-height:1.5">
  <h1>VTT — сервер Мастера работает</h1>
  <p>Веб-клиент не собран. Запустите <code style="background:#27272a;padding:2px 6px;border-radius:4px">npm run dev:client</code>
  и откройте <code style="background:#27272a;padding:2px 6px;border-radius:4px">http://localhost:5173/?session=&lt;id&gt;</code>,
  либо соберите клиент командой <code style="background:#27272a;padding:2px 6px;border-radius:4px">npm run build</code>.</p>
</body></html>`)
      return
    }

    const root = resolve(clientDistDir)
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
    const candidate = resolve(root, relative)
    if (candidate !== root && !candidate.startsWith(root + sep)) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }

    try {
      await serveFile(res, candidate, 'no-cache')
    } catch {
      // SPA-фолбэк: любой неизвестный путь без расширения отдаёт index.html
      if (extname(pathname) === '') {
        try {
          await serveFile(res, resolve(root, 'index.html'), 'no-cache')
          return
        } catch {
          // ниже 404
        }
      }
      res.writeHead(404)
      res.end('Not found')
    }
  }

  async function handleHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const rawUrl = req.url ?? '/'
    // Запросы Socket.io обрабатывает сам сервер socket.io
    if (rawUrl.startsWith('/socket.io')) return

    let url: URL
    try {
      url = new URL(rawUrl, `http://${req.headers.host ?? `localhost:${port}`}`)
    } catch {
      res.writeHead(400)
      res.end('Bad request')
      return
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405)
      res.end('Method not allowed')
      return
    }

    let pathname: string
    try {
      pathname = decodeURIComponent(url.pathname)
    } catch {
      res.writeHead(400)
      res.end('Bad request')
      return
    }

    if (pathname.startsWith('/session-assets/')) {
      const rest = pathname.slice('/session-assets/'.length)
      const slash = rest.indexOf('/')
      if (slash <= 0) {
        res.writeHead(404)
        res.end('Not found')
        return
      }
      const sessionId = rest.slice(0, slash)
      const relativePath = rest.slice(slash + 1)
      await serveSessionAsset(res, sessionId, relativePath)
      return
    }

    if (pathname === '/api/health') {
      const session = sessionManager.getActive()
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      })
      res.end(
        JSON.stringify({
          ok: true,
          sessionId: session?.id ?? null,
          players: session ? (playersBySession.get(session.id)?.size ?? 0) : 0
        })
      )
      return
    }

    await serveClient(res, pathname)
  }

  const httpServer = createServer((req, res) => {
    void handleHttp(req, res).catch((error) => {
      console.error('[server] ошибка HTTP-обработчика:', error)
      if (!res.headersSent) {
        res.writeHead(500)
        res.end('Internal server error')
      }
    })
  })

  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer, {
    cors: { origin: '*' },
    serveClient: false,
    pingTimeout: 20000,
    maxHttpBufferSize: 5e6
  })

  /** sessionId -> socketId -> участник */
  const playersBySession = new Map<string, Map<string, PlayerInfo>>()

  const playersOf = (sessionId: string): PlayerInfo[] => [
    ...(playersBySession.get(sessionId)?.values() ?? [])
  ]

  const broadcastPlayers = (sessionId: string): void => {
    const players = playersOf(sessionId)
    io.to(sessionId).emit('players:update', players)
    if (sessionId === sessionManager.getActive()?.id) {
      onHostEvent({ type: 'players:update', players })
    }
  }

  const addPlayer = (sessionId: string, socketId: string, player: PlayerInfo): void => {
    const map = playersBySession.get(sessionId) ?? new Map<string, PlayerInfo>()
    map.set(socketId, player)
    playersBySession.set(sessionId, map)
  }

  const removePlayer = (sessionId: string, socketId: string): void => {
    const map = playersBySession.get(sessionId)
    if (!map) return
    map.delete(socketId)
    if (map.size === 0) playersBySession.delete(sessionId)
  }

  /** Активная сессия, к которой реально подключён этот сокет */
  const socketSession = (socket: VttSocket): Session | null => {
    const session = sessionManager.getActive()
    if (!session || socket.data.sessionId !== session.id) return null
    return session
  }

  const emitError = (socket: VttSocket, message: string): void => {
    socket.emit('error:message', { message })
  }

  io.on('connection', (socket) => {
    console.log(`[server] подключение: ${socket.id}`)
    notifyStatus()

    socket.on('client:join', (data, ack) => {
      const session = sessionManager.getActive()
      if (!session) {
        ack?.({
          ok: false,
          sessionId: data?.sessionId ?? '',
          players: 0,
          error: 'Мастер ещё не открыл сессию'
        })
        return
      }
      if (data?.sessionId !== session.id) {
        ack?.({
          ok: false,
          sessionId: data?.sessionId ?? '',
          players: 0,
          error: 'Сессия не найдена или уже закрыта'
        })
        return
      }

      // Переход из предыдущей сессии
      const previous = socket.data.sessionId
      if (previous && previous !== session.id) {
        void socket.leave(previous)
        removePlayer(previous, socket.id)
        broadcastPlayers(previous)
      }

      socket.data.sessionId = session.id
      socket.data.playerName = sanitizePlayerName(data.playerName)
      socket.data.role = 'player'
      socket.data.color = colorForPlayer(`${socket.id}:${socket.data.playerName}`)

      void socket.join(session.id)

      addPlayer(session.id, socket.id, {
        id: socket.id,
        name: socket.data.playerName,
        role: 'player',
        color: socket.data.color
      })

      const players = playersOf(session.id).length
      console.log(
        `[server] «${socket.data.playerName}» вошёл в сессию ${session.id} (игроков: ${players})`
      )

      ack?.({ ok: true, sessionId: session.id, players })
      socket.emit('session:update', playerSession(session))
      broadcastPlayers(session.id)
      notifyStatus()
    })

    socket.on('session:request', () => {
      const session = socketSession(socket)
      if (!session) {
        emitError(socket, 'Сначала подключитесь к сессии')
        return
      }
      socket.emit('session:update', playerSession(session))
      socket.emit('players:update', playersOf(session.id))
    })

    socket.on('token:move', (data) => {
      handleTokenPatch(socket, {
        tokenId: data?.tokenId ?? '',
        x: data?.x,
        y: data?.y
      })
    })

    socket.on('token:update', (data) => {
      handleTokenPatch(socket, data ?? { tokenId: '' })
    })

    function handleTokenPatch(socket: VttSocket, patch: TokenPatch): void {
      const session = socketSession(socket)
      if (!session || !patch.tokenId) return
      const token = session.tokens.find((item) => item.id === patch.tokenId)
      if (!token) return

      // Игрок не может трогать скрытые и закреплённые токены
      if (socket.data.role === 'player' && (token.hidden || token.locked)) return

      let result: TokenPatch | null = null
      sessionManager.updateSilent((current) => {
        result = applyTokenPatch(current, patch)
      })
      if (!result) return

      io.to(session.id).emit('token:update', result)
      console.log(`[server] token:update ${patch.tokenId} от ${socket.data.playerName}`)
      onHostEvent({ type: 'token:update', patch: result })
    }

    socket.on('chat:send', (data) => {
      const session = socketSession(socket)
      if (!session) return
      const text = typeof data?.text === 'string' ? data.text.slice(0, 2000).trim() : ''
      if (!text) return

      const message: ChatMessage = {
        id: newId('msg'),
        userId: socket.id,
        userName: socket.data.playerName ?? 'Игрок',
        text,
        timestamp: Date.now()
      }
      sessionManager.updateSilent((current) => {
        current.chatLog = trimLog([...current.chatLog, message], MAX_CHAT_LOG)
      })
      io.to(session.id).emit('chat:message', message)
      onHostEvent({ type: 'chat:message', message })
    })

    socket.on('dice:roll', (data) => {
      const session = socketSession(socket)
      if (!session) return
      const dice = Array.isArray(data?.dice)
        ? data.dice
            .slice(0, MAX_DICE_PER_ROLL)
            .filter((die): die is string => typeof die === 'string' && diceSides(die) !== null)
        : []
      if (dice.length === 0) {
        emitError(socket, 'Некорректный набор кубиков')
        return
      }

      const { results, total } = rollDice(dice)
      const roll: DiceRoll = {
        id: newId('roll'),
        userId: socket.id,
        userName: socket.data.playerName ?? 'Игрок',
        dice,
        results,
        total,
        timestamp: Date.now()
      }
      // Результат броска дублируется в чат (ТЗ, п.6: «Отображение результата в чате»)
      const message: ChatMessage = {
        id: newId('msg'),
        userId: socket.id,
        userName: roll.userName,
        text: `🎲 ${formatDice(dice)} → ${results.join(' + ')} = ${total}`,
        timestamp: roll.timestamp
      }
      sessionManager.updateSilent((current) => {
        current.rollLog = trimLog([...current.rollLog, roll], MAX_ROLL_LOG)
        current.chatLog = trimLog([...current.chatLog, message], MAX_CHAT_LOG)
      })
      io.to(session.id).emit('dice:roll', roll)
      io.to(session.id).emit('chat:message', message)
      console.log(`[server] бросок ${dice.join('+')} = ${total} (${socket.data.playerName})`)
      onHostEvent({ type: 'dice:roll', roll })
      onHostEvent({ type: 'chat:message', message })
    })

    socket.on('drawing:add', (data) => {
      const session = socketSession(socket)
      if (!session) return
      if (!data || !Array.isArray(data.points)) return
      const points = data.points.filter(isFiniteNumber).slice(0, 20000)
      if (points.length < 4) return

      const drawing: Drawing = {
        id: newId('drw'),
        tool: data.tool === 'eraser' ? 'eraser' : 'pencil',
        color: sanitizeColor(data.color),
        size: clamp(isFiniteNumber(data.size) ? data.size : 4, 1, 200),
        points,
        authorId: socket.id,
        authorName: socket.data.playerName ?? 'Игрок',
        createdAt: Date.now()
      }
      sessionManager.updateSilent((current) => {
        current.drawings = [...current.drawings, drawing]
      })
      io.to(session.id).emit('drawing:add', drawing)
      onHostEvent({ type: 'drawing:add', drawing })
    })

    socket.on('fog:update', (data) => {
      const session = socketSession(socket)
      if (!session) return
      // Туман войны меняет только Мастер (уточнение 7: GM-only проверка на сервере)
      if (socket.data.role !== 'gm') {
        emitError(socket, 'Туман войны может менять только Мастер')
        return
      }
      const fog = sanitizeFog(data)
      if (!fog) return
      sessionManager.updateSilent((current) => {
        current.fogOfWar = fog
      })
      io.to(session.id).emit('fog:update', fog)
      onHostEvent({ type: 'fog:update', fog })
    })

    socket.on('disconnect', (reason) => {
      const sessionId = socket.data.sessionId
      if (sessionId) {
        removePlayer(sessionId, socket.id)
        broadcastPlayers(sessionId)
      }
      console.log(`[server] отключение: ${socket.id} (${reason})`)
      notifyStatus()
    })
  })

  httpServer.listen(port, () => {
    console.log(`[server] Socket.IO сервер запущен: http://0.0.0.0:${port}`)
    console.log(`[server] локальная сеть: http://${lanIp}:${clientPort}`)
    if (servingClient) console.log(`[server] веб-клиент раздаётся с этого же сервера`)
    notifyStatus()
  })

  httpServer.on('error', (error) => {
    console.error('[server] ошибка HTTP-сервера:', error.message)
    notifyStatus()
  })

  const vttServer: VttServer = {
    getStatus: status,
    getPlayers: () => {
      const session = sessionManager.getActive()
      return session ? playersOf(session.id) : []
    },
    broadcastSession(session) {
      if (!session) return
      io.to(session.id).emit('session:update', playerSession(session))
    },
    tokenAdded(token) {
      const session = sessionManager.getActive()
      if (!session) return
      if (!token.hidden) io.to(session.id).emit('token:add', token)
      onHostEvent({ type: 'token:add', token })
    },
    tokenUpdated(patch) {
      const session = sessionManager.getActive()
      if (!session) return
      io.to(session.id).emit('token:update', patch)
      onHostEvent({ type: 'token:update', patch })
    },
    tokenRemoved(tokenId) {
      const session = sessionManager.getActive()
      if (!session) return
      io.to(session.id).emit('token:remove', { tokenId })
      onHostEvent({ type: 'token:remove', tokenId })
    },
    fogUpdated(fog) {
      const session = sessionManager.getActive()
      if (!session) return
      io.to(session.id).emit('fog:update', fog)
      onHostEvent({ type: 'fog:update', fog })
    },
    drawingAdded(drawing) {
      const session = sessionManager.getActive()
      if (!session) return
      io.to(session.id).emit('drawing:add', drawing)
      onHostEvent({ type: 'drawing:add', drawing })
    },
    chatMessage(message) {
      const session = sessionManager.getActive()
      if (!session) return
      io.to(session.id).emit('chat:message', message)
      onHostEvent({ type: 'chat:message', message })
    },
    diceRolled(roll) {
      const session = sessionManager.getActive()
      if (!session) return
      io.to(session.id).emit('dice:roll', roll)
      onHostEvent({ type: 'dice:roll', roll })
    },
    sessionClosed(reason) {
      const session = sessionManager.getActive()
      const rooms = new Set<string>()
      if (session) rooms.add(session.id)
      for (const sessionId of playersBySession.keys()) rooms.add(sessionId)
      for (const room of rooms) {
        io.to(room).emit('session:closed', { reason })
        // Сокеты покидают комнату: после закрытия сессии нужен повторный вход
        io.in(room).socketsLeave(room)
      }
      playersBySession.clear()
      onHostEvent({ type: 'session:closed', reason })
      notifyStatus()
    },
    async stop() {
      await new Promise<void>((resolveStop) => {
        io.close(() => resolveStop())
      })
      await new Promise<void>((resolveStop) => {
        if (!httpServer.listening) {
          resolveStop()
          return
        }
        httpServer.close(() => resolveStop())
      })
    }
  }

  return vttServer
}
