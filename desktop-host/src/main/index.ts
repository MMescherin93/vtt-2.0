import { app, BrowserWindow, ipcMain } from 'electron'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type {
  ChatMessage,
  DiceRoll,
  Drawing,
  DrawingInput,
  FogOfWarData,
  Session,
  Token
} from '@vtt/shared'
import {
  MAX_CHAT_LOG,
  MAX_DICE_PER_ROLL,
  MAX_ROLL_LOG,
  diceSides,
  formatDice,
  newId,
  rollDice,
  sanitizeFog,
  trimLog,
  worldSize
} from '@vtt/shared/utils'
import {
  IPC,
  type AddAssetInput,
  type AddTokenInput,
  type CreateSessionInput,
  type HostServerEvent,
  type InviteInfo,
  type ServerStatus,
  type SessionPatch,
  type TokenPatchInput
} from '../shared/ipc'
import { buildInvite } from './invite'
import { applyTokenPatch, startVttServer, type VttServer } from './server'
import { SessionManager } from './session'
import { SettingsStore } from './settings'
import { SessionStorage } from './storage'
import { TunnelManager } from './tunnel'

const PORT = Number(process.env['VTT_PORT'] ?? 3001)
/** Порт веб-клиента в режиме разработки (vite) */
const DEV_CLIENT_PORT = 5173

let mainWindow: BrowserWindow | null = null
let server: VttServer | null = null
let sessionManager: SessionManager | null = null
let tunnel: TunnelManager | null = null
let settings: SettingsStore | null = null
let statusCache: ServerStatus = {
  port: PORT,
  listening: false,
  clients: 0,
  lanIp: '127.0.0.1',
  clientPort: DEV_CLIENT_PORT,
  servingClient: false
}

function sendStatus(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.serverStatusEvent, statusCache)
  }
}

function sendHostEvent(event: HostServerEvent): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.serverEvent, event)
  }
}

/** Ищет собранный веб-клиент, чтобы раздавать его с того же порта */
function findClientDist(): string | null {
  const candidates = [
    resolve(app.getAppPath(), '..', 'web-client', 'dist'),
    resolve(process.cwd(), '..', 'web-client', 'dist'),
    resolve(process.cwd(), 'web-client', 'dist'),
    resolve(app.getAppPath(), 'web-client', 'dist'),
    resolve(__dirname, '..', '..', '..', '..', 'web-client', 'dist')
  ]
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'index.html'))) return candidate
  }
  return null
}

function currentInvite(): InviteInfo {
  const tunnelStatus = tunnel?.getStatus() ?? {
    available: false,
    running: false,
    url: null,
    error: null
  }
  return buildInvite(
    {
      lanIp: statusCache.lanIp,
      clientPort: statusCache.clientPort,
      servingClient: statusCache.servingClient,
      tunnelUrl: tunnelStatus.url ?? settings?.get().tunnelUrl ?? null,
      tunnel: tunnelStatus
    },
    sessionManager?.getActiveId() ?? null
  )
}

/**
 * Иконка окна. Electron не всегда читает файлы из путей с кириллицей, поэтому
 * лаунчер кладёт копию в ASCII-папку `%LOCALAPPDATA%\VTT\vtt.ico` — её и берём.
 */
function resolveWindowIcon(): string | undefined {
  const candidates = [
    process.env['LOCALAPPDATA'] ? join(process.env['LOCALAPPDATA'], 'VTT', 'vtt.ico') : '',
    process.env['PUBLIC'] ? join(process.env['PUBLIC'], 'VTT', 'vtt.ico') : '',
    join(app.getAppPath(), 'build', 'icon.ico')
  ].filter(Boolean)
  return candidates.find((candidate) => existsSync(candidate))
}

function createMainWindow(): void {
  const iconPath = resolveWindowIcon()
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#1a1a1a',
    title: 'VTT — Host GM',
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    sendStatus()
    if (sessionManager?.getActive()) {
      sendHostEvent({ type: 'session:update', session: sessionManager.getActive() })
    }
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    void mainWindow.loadURL(rendererUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC.serverStatusGet, (): ServerStatus => statusCache)

  ipcMain.handle(IPC.sessionsList, async () => sessionManager?.list() ?? [])

  ipcMain.handle(IPC.sessionsCreate, async (_event, input: CreateSessionInput) => {
    if (!sessionManager) throw new Error('Хранилище сессий не готово')
    if (sessionManager.getActiveId()) {
      server?.sessionClosed('Мастер создал новую сессию')
    }
    const session = await sessionManager.create(input?.name ?? '', input?.description ?? '')
    await settings?.update({ lastSessionId: session.id })
    return session
  })

  ipcMain.handle(IPC.sessionsDelete, async (_event, sessionId: string) => {
    if (!sessionManager) return
    if (sessionManager.getActiveId() === sessionId) {
      server?.sessionClosed('Сессия удалена Мастером')
    }
    await sessionManager.remove(sessionId)
    if (settings?.get().lastSessionId === sessionId) {
      await settings.update({ lastSessionId: null })
    }
  })

  ipcMain.handle(IPC.sessionsActivate, async (_event, sessionId: string | null) => {
    if (!sessionManager) return null
    const previous = sessionManager.getActiveId()
    if (previous && previous !== sessionId) {
      server?.sessionClosed('Мастер открыл другую сессию')
    }
    const session = await sessionManager.activate(sessionId)
    await settings?.update({ lastSessionId: session?.id ?? null })
    return session
  })

  ipcMain.handle(IPC.sessionsActive, () => sessionManager?.getActive() ?? null)

  ipcMain.handle(IPC.sessionUpdate, async (_event, patch: SessionPatch) => {
    if (!sessionManager) return null
    return sessionManager.update((current: Session) => {
      if (patch.name !== undefined) {
        current.name = String(patch.name).slice(0, 120).trim() || current.name
      }
      if (patch.description !== undefined) {
        current.description = String(patch.description).slice(0, 4000)
      }
      if (patch.clearMaps) {
        current.maps = []
      }
      if (patch.removeMapId) {
        current.maps = current.maps.filter((map) => map.id !== patch.removeMapId)
      }
      if (patch.addMap) {
        const width = Math.max(0, Math.round(Number(patch.addMap.width) || 0))
        const height = Math.max(0, Math.round(Number(patch.addMap.height) || 0))
        const imageUrl = String(patch.addMap.imageUrl ?? '')
        if (imageUrl && width > 0 && height > 0) {
          current.maps.push({ id: newId('map'), imageUrl, width, height })
        }
      }
      if (patch.moveMap) {
        const index = current.maps.findIndex((map) => map.id === patch.moveMap!.mapId)
        const target = patch.moveMap.direction === 'left' ? index - 1 : index + 1
        if (index >= 0 && target >= 0 && target < current.maps.length) {
          const [moved] = current.maps.splice(index, 1)
          if (moved) current.maps.splice(target, 0, moved)
        }
      }
      if (patch.settings) {
        const { gridType, gridSize, showGrid } = patch.settings
        if (gridType === 'square' || gridType === 'hex' || gridType === 'none') {
          current.settings.gridType = gridType
        }
        if (typeof gridSize === 'number' && Number.isFinite(gridSize)) {
          current.settings.gridSize = Math.min(400, Math.max(20, Math.round(gridSize)))
        }
        if (typeof showGrid === 'boolean') {
          current.settings.showGrid = showGrid
        }
      }
    })
  })

  ipcMain.handle(IPC.sessionAddAsset, async (_event, input: AddAssetInput) => {
    if (!sessionManager) return null
    const data = new Uint8Array(input.data)
    if (data.byteLength === 0) throw new Error('Пустой файл')
    if (data.byteLength > 50 * 1024 * 1024) throw new Error('Файл слишком большой (максимум 50 МБ)')
    return sessionManager.addAsset(input.fileName, data, input.kind)
  })

  ipcMain.handle(IPC.tokenAdd, async (_event, input: AddTokenInput): Promise<Token | null> => {
    if (!sessionManager) return null
    const session = sessionManager.getActive()
    if (!session) return null

    let imagePath = input.imagePath ?? ''
    if (input.image?.data) {
      const asset = await sessionManager.addAsset(
        input.image.fileName,
        new Uint8Array(input.image.data),
        'token'
      )
      if (asset) imagePath = asset.relativePath
    }

    const size = Math.min(4000, Math.max(20, Math.round(Number(input.size) || 70)))
    const world = worldSize(session.maps)
    const token: Token = {
      id: newId('tok'),
      name:
        String(input.name ?? '')
          .trim()
          .slice(0, 80) || 'Токен',
      imageUrl: imagePath,
      x: Math.min(world.width || 10000, Math.max(0, Number(input.x) || 0)),
      y: Math.min(world.height || 10000, Math.max(0, Number(input.y) || 0)),
      width: size,
      height: size,
      rotation: 0,
      hidden: Boolean(input.hidden),
      locked: false
    }

    sessionManager.updateSilent((current) => {
      current.tokens.push(token)
    })
    server?.tokenAdded(token)
    return token
  })

  ipcMain.handle(IPC.tokenUpdate, async (_event, patch: TokenPatchInput) => {
    if (!sessionManager) return
    const session = sessionManager.getActive()
    if (!session) return
    if (!session.tokens.some((token) => token.id === patch.tokenId)) return

    const structural =
      patch.hidden !== undefined || patch.locked !== undefined || patch.name !== undefined

    if (structural) {
      // Смена видимости/имени меняет состояние для игроков — полная рассылка
      sessionManager.update((current) => {
        const token = current.tokens.find((item) => item.id === patch.tokenId)
        if (!token) return
        if (patch.name !== undefined) token.name = String(patch.name).slice(0, 80)
        if (patch.hidden !== undefined) token.hidden = Boolean(patch.hidden)
        if (patch.locked !== undefined) token.locked = Boolean(patch.locked)
        applyTokenPatch(current, patch)
      })
      return
    }

    let result: ReturnType<typeof applyTokenPatch> = null
    sessionManager.updateSilent((current) => {
      result = applyTokenPatch(current, patch)
    })
    if (result) server?.tokenUpdated(result)
  })

  ipcMain.handle(IPC.tokenRemove, async (_event, tokenId: string) => {
    if (!sessionManager) return
    sessionManager.updateSilent((current) => {
      current.tokens = current.tokens.filter((token) => token.id !== tokenId)
    })
    server?.tokenRemoved(tokenId)
  })

  ipcMain.handle(IPC.fogUpdate, async (_event, fog: FogOfWarData) => {
    if (!sessionManager) return
    const safeFog = sanitizeFog(fog)
    if (!safeFog) return
    sessionManager.updateSilent((current) => {
      current.fogOfWar = safeFog
    })
    server?.fogUpdated(safeFog)
  })

  ipcMain.handle(IPC.drawingAdd, async (_event, input: DrawingInput) => {
    if (!sessionManager) return
    if (!input || !Array.isArray(input.points) || input.points.length < 4) return
    const drawing: Drawing = {
      id: newId('drw'),
      tool: input.tool === 'eraser' ? 'eraser' : 'pencil',
      color: /^#[0-9a-fA-F]{6}$/.test(input.color) ? input.color : '#f8fafc',
      size: Math.min(200, Math.max(1, Number(input.size) || 4)),
      points: input.points.filter((value) => Number.isFinite(value)).slice(0, 20000),
      authorId: 'gm',
      authorName: 'Мастер',
      createdAt: Date.now()
    }
    sessionManager.updateSilent((current) => {
      current.drawings = [...current.drawings, drawing]
    })
    server?.drawingAdded(drawing)
  })

  ipcMain.handle(IPC.chatSend, async (_event, text: string) => {
    if (!sessionManager) return
    const value = String(text ?? '')
      .slice(0, 2000)
      .trim()
    if (!value) return
    const message: ChatMessage = {
      id: newId('msg'),
      userId: 'gm',
      userName: 'Мастер',
      text: value,
      timestamp: Date.now()
    }
    sessionManager.updateSilent((current) => {
      current.chatLog = trimLog([...current.chatLog, message], MAX_CHAT_LOG)
    })
    server?.chatMessage(message)
  })

  ipcMain.handle(IPC.diceRoll, async (_event, dice: string[]) => {
    if (!sessionManager) return
    const list = Array.isArray(dice)
      ? dice
          .slice(0, MAX_DICE_PER_ROLL)
          .filter((die): die is string => typeof die === 'string' && diceSides(die) !== null)
      : []
    if (list.length === 0) return
    const { results, total } = rollDice(list)
    const roll: DiceRoll = {
      id: newId('roll'),
      userId: 'gm',
      userName: 'Мастер',
      dice: list,
      results,
      total,
      timestamp: Date.now()
    }
    // Результат броска дублируется в чат (ТЗ, п.6)
    const message: ChatMessage = {
      id: newId('msg'),
      userId: 'gm',
      userName: 'Мастер',
      text: `🎲 ${formatDice(list)} → ${results.join(' + ')} = ${total}`,
      timestamp: roll.timestamp
    }
    sessionManager.updateSilent((current) => {
      current.rollLog = trimLog([...current.rollLog, roll], MAX_ROLL_LOG)
      current.chatLog = trimLog([...current.chatLog, message], MAX_CHAT_LOG)
    })
    server?.diceRolled(roll)
    server?.chatMessage(message)
  })

  ipcMain.handle(
    IPC.extensionUpdate,
    async (_event, extensionId: string, state: unknown): Promise<void> => {
      if (!sessionManager) return
      if (typeof extensionId !== 'string' || !extensionId) return
      sessionManager.updateSilent((current) => {
        current.extensionState = { ...current.extensionState, [extensionId]: state }
      })
      server?.extensionUpdated(extensionId, state)
    }
  )

  ipcMain.handle(IPC.inviteGet, (): InviteInfo => currentInvite())

  ipcMain.handle(
    IPC.inviteSetTunnelUrl,
    async (_event, url: string | null): Promise<InviteInfo> => {
      const normalized = normalizeTunnelUrl(url)
      await settings?.update({ tunnelUrl: normalized })
      return currentInvite()
    }
  )

  ipcMain.handle(IPC.tunnelStart, async (): Promise<InviteInfo> => {
    await tunnel?.start()
    return currentInvite()
  })

  ipcMain.handle(IPC.tunnelStop, async (): Promise<InviteInfo> => {
    tunnel?.stop()
    return currentInvite()
  })
}

function normalizeTunnelUrl(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    const dataDir = process.env['VTT_DATA_DIR'] ?? join(app.getPath('userData'), 'vtt-data')
    const settingsFile = join(app.getPath('userData'), 'vtt-settings.json')

    settings = new SettingsStore(settingsFile)
    await settings.load()

    const storage = new SessionStorage(dataDir)
    await storage.ensureRoot()

    sessionManager = new SessionManager(storage)
    const clientDistDir = findClientDist()

    server = startVttServer({
      port: PORT,
      clientPort: clientDistDir ? PORT : DEV_CLIENT_PORT,
      clientDistDir,
      extensionsDir: join(app.getAppPath(), 'extensions'),
      sessionManager,
      storage,
      onStatusChange: (status) => {
        statusCache = status
        sendStatus()
      },
      onHostEvent: (event) => sendHostEvent(event)
    })
    statusCache = server.getStatus()

    tunnel = new TunnelManager(PORT, () => {
      // Статус туннеля не входит в ServerStatus, но его изменение полезно
      // отправить окну, чтобы обновить подсказку в панели приглашения
      sendStatus()
    })
    void tunnel.checkAvailable().then(() => sendStatus())

    sessionManager.onChange = (session) => {
      if (session) {
        server?.broadcastSession(session)
        sendHostEvent({ type: 'session:update', session })
      } else {
        sendHostEvent({ type: 'session:update', session: null })
      }
    }

    // Восстанавливаем последнюю открытую сессию (ТЗ: «Загрузка состояния сессии при открытии»)
    const lastSessionId = settings.get().lastSessionId
    if (lastSessionId) {
      const restored = await sessionManager.activate(lastSessionId)
      if (!restored) {
        await settings.update({ lastSessionId: null })
      }
    }

    registerIpc()
    createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  app.on('before-quit', () => {
    tunnel?.stop()
    void sessionManager?.flush()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
