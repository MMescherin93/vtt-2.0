import type {
  ChatMessage,
  DiceRoll,
  Drawing,
  DrawingInput,
  FogOfWarData,
  MapData,
  MapSettings,
  PlayerInfo,
  Session,
  SessionSummary,
  Token,
  TokenPatch
} from '@vtt/shared'

/** Каналы IPC между главным процессом и окном хоста */
export const IPC = {
  serverStatusGet: 'server:get-status',
  serverStatusEvent: 'server:status',
  serverEvent: 'server:event',

  sessionsList: 'sessions:list',
  sessionsCreate: 'sessions:create',
  sessionsDelete: 'sessions:delete',
  sessionsActivate: 'sessions:activate',
  sessionsActive: 'sessions:active',
  sessionUpdate: 'session:update',

  sessionAddAsset: 'session:add-asset',
  tokenAdd: 'token:add',
  tokenUpdate: 'token:update',
  tokenRemove: 'token:remove',
  fogUpdate: 'fog:update',
  drawingAdd: 'drawing:add',
  chatSend: 'chat:send',
  diceRoll: 'dice:roll',

  inviteGet: 'invite:get',
  inviteSetTunnelUrl: 'invite:set-tunnel-url',
  tunnelStart: 'tunnel:start',
  tunnelStop: 'tunnel:stop'
} as const

/** Статус WebSocket-сервера и адреса для отображения в окне хоста */
export interface ServerStatus {
  /** Порт Socket.io сервера */
  port: number
  /** Слушает ли сервер входящие подключения */
  listening: boolean
  /** Число подключённых клиентов */
  clients: number
  /** IPv4-адрес машины в локальной сети */
  lanIp: string
  /** Порт, на котором открывается веб-клиент */
  clientPort: number
  /** Раздаёт ли хост собранный веб-клиент */
  servingClient: boolean
}

export interface TunnelStatus {
  /** Есть ли в системе cloudflared */
  available: boolean
  running: boolean
  url: string | null
  error: string | null
}

/** Данные ссылки-приглашения (ТЗ, п.1: «Генерация уникальной ссылки-приглашения») */
export interface InviteInfo {
  sessionId: string | null
  /** Итоговая ссылка для игроков (туннель > LAN > localhost) */
  inviteUrl: string | null
  localUrl: string | null
  lanUrl: string | null
  tunnelUrl: string | null
  lanIp: string
  clientPort: number
  servingClient: boolean
  tunnel: TunnelStatus
}

export interface CreateSessionInput {
  name: string
  description: string
}

/** Изменение сессии из UI Мастера */
export interface SessionPatch {
  name?: string
  description?: string
  settings?: Partial<MapSettings>
  /** Добавить карту в конец полотна */
  addMap?: MapData
  /** Удалить карту по id */
  removeMapId?: string
  /** Удалить все карты */
  clearMaps?: boolean
}

export interface AddAssetInput {
  fileName: string
  data: ArrayBuffer
  kind: 'map' | 'token'
}

export interface AssetResult {
  relativePath: string
  width: number
  height: number
}

export interface AddTokenInput {
  name: string
  x: number
  y: number
  /** Размер стороны токена в пикселях карты */
  size: number
  /** Уже загруженный ассет */
  imagePath?: string
  /** Новое изображение токена */
  image?: { fileName: string; data: ArrayBuffer }
  hidden?: boolean
}

/** Расширенное изменение токена из UI Мастера (включая GM-only поля) */
export interface TokenPatchInput extends TokenPatch {
  hidden?: boolean
  locked?: boolean
  name?: string
}

/** События сервера, которые главный процесс пересылает в окно хоста */
export type HostServerEvent =
  | { type: 'session:update'; session: Session | null }
  | { type: 'players:update'; players: PlayerInfo[] }
  | { type: 'token:add'; token: Token }
  | { type: 'token:update'; patch: TokenPatch }
  | { type: 'token:remove'; tokenId: string }
  | { type: 'fog:update'; fog: FogOfWarData }
  | { type: 'drawing:add'; drawing: Drawing }
  | { type: 'chat:message'; message: ChatMessage }
  | { type: 'dice:roll'; roll: DiceRoll }
  | { type: 'session:closed'; reason: string }

/** API, доступное рендереру хоста через preload (contextBridge) */
export interface HostApi {
  getServerStatus(): Promise<ServerStatus>
  /** Подписка на обновления статуса; возвращает функцию отписки */
  onServerStatus(callback: (status: ServerStatus) => void): () => void
  /** Подписка на события сессии (токены, чат, кубики, туман) */
  onServerEvent(callback: (event: HostServerEvent) => void): () => void

  listSessions(): Promise<SessionSummary[]>
  createSession(input: CreateSessionInput): Promise<Session>
  deleteSession(sessionId: string): Promise<void>
  activateSession(sessionId: string | null): Promise<Session | null>
  getActiveSession(): Promise<Session | null>
  updateSession(patch: SessionPatch): Promise<Session | null>

  addAsset(input: AddAssetInput): Promise<AssetResult | null>
  addToken(input: AddTokenInput): Promise<Token | null>
  updateToken(patch: TokenPatchInput): Promise<void>
  removeToken(tokenId: string): Promise<void>

  updateFog(fog: FogOfWarData): Promise<void>
  addDrawing(drawing: DrawingInput): Promise<void>
  sendChat(text: string): Promise<void>
  rollDice(dice: string[]): Promise<void>

  getInvite(): Promise<InviteInfo>
  setTunnelUrl(url: string | null): Promise<InviteInfo>
  startTunnel(): Promise<InviteInfo>
  stopTunnel(): Promise<InviteInfo>
}
