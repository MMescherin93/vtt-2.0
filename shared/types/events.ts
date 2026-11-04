import type {
  Drawing,
  DrawingInput,
  FogOfWarData,
  MapText,
  MapTextInput,
  MapTextPatch,
  TokenPatch
} from './map'
import type { ChatMessage, DiceRoll, PlayerInfo, Session } from './session'
import type { Token } from './token'
import type { CombatState } from './combat'

/** Обновление состояния расширения (модуля) сессии */
export interface ExtensionUpdateData {
  extensionId: string
  state: unknown
}

/** Аргументы событий (ТЗ, «WebSocket события (API)») */

export interface ClientJoinData {
  sessionId: string
  playerName: string
}

export interface ClientJoinAck {
  ok: boolean
  sessionId: string
  /** Число игроков в сессии (включая этого) */
  players: number
  /** Причина отказа, если ok === false */
  error?: string
}

/** Совместимый с ТЗ вариант обновления токена */
export interface TokenUpdateData {
  tokenId: string
  x: number
  y: number
  rotation?: number
}

export interface TokenMoveData {
  tokenId: string
  x: number
  y: number
}

export interface ChatSendData {
  text: string
}

/** ТЗ: 'chat:message' -> { userId, text, timestamp } (+ имя отправителя) */
export type ChatMessageData = Omit<ChatMessage, 'id'>

export interface DiceRollRequestData {
  /** Например: ['d20', 'd6'] */
  dice: string[]
}

/** ТЗ: 'dice:roll' -> { userId, dice, results, total } (+ имя и время) */
export type DiceRollResultData = Omit<DiceRoll, 'id'>

/** События Server -> Host/Client */
export interface ServerToClientEvents {
  'session:update': (session: Session) => void
  /** Сессия закрыта/удалена Мастером */
  'session:closed': (data: { reason: string }) => void
  'players:update': (players: PlayerInfo[]) => void
  'token:update': (data: TokenPatch) => void
  'token:add': (token: Token) => void
  'token:remove': (data: { tokenId: string }) => void
  'fog:update': (fog: FogOfWarData) => void
  'drawing:add': (drawing: Drawing) => void
  'text:add': (text: MapText) => void
  'text:update': (text: MapText) => void
  'text:remove': (data: { textId: string }) => void
  'chat:message': (data: ChatMessageData) => void
  'dice:roll': (data: DiceRollResultData) => void
  /** Состояние расширения изменил Мастер */
  'extension:update': (data: ExtensionUpdateData) => void
  /** Состояние боя изменилось (игрокам — без скрытых бойцов) */
  'combat:update': (data: { combat: CombatState | null }) => void
  /** Ошибка/отказ в операции (например, GM-only действие от игрока) */
  'error:message': (data: { message: string }) => void
}

/** События Client -> Host */
export interface ClientToServerEvents {
  'client:join': (data: ClientJoinData, ack?: (res: ClientJoinAck) => void) => void
  /** Запрос состояния; ответ — событие 'session:update' */
  'session:request': () => void
  /** Сохранить состояние модуля (только модули с playerWritable) */
  'extension:update': (data: ExtensionUpdateData) => void
  /** Перемещение токена (двигать может любой участник — уточнение 4) */
  'token:move': (data: TokenMoveData) => void
  /** Перемещение/размер/поворот токена */
  'token:update': (data: TokenPatch) => void
  'chat:send': (data: ChatSendData) => void
  'dice:roll': (data: DiceRollRequestData) => void
  /** Рисовать может любой участник (ТЗ, п.5) */
  'drawing:add': (data: DrawingInput) => void
  /** Текстовые заметки: добавлять может любой, править — автор или Мастер */
  'text:add': (data: MapTextInput) => void
  'text:update': (data: MapTextPatch) => void
  'text:remove': (data: { textId: string }) => void
  /** Туман войны меняет только GM (проверка роли на сервере) */
  'fog:update': (fog: FogOfWarData) => void
}

/** Данные сокета, назначаемые при подключении/входе в сессию */
export interface SocketData {
  sessionId?: string
  playerName?: string
  /** GM — всегда хост через десктопное приложение (уточнение 7) */
  role?: 'gm' | 'player'
  color?: string
}
