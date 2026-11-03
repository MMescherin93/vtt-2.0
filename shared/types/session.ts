import type { Drawing, FogOfWarData, MapData, MapSettings } from './map'
import type { Token } from './token'

/** Роль участника: GM — всегда хост десктопного приложения (уточнение 7) */
export type PlayerRole = 'gm' | 'player'

/** Сообщение чата (хранится в сессии и рассылается участникам) */
export interface ChatMessage {
  id: string
  userId: string
  userName: string
  text: string
  timestamp: number
}

/** Результат броска кубиков (используется и для чата, и для истории) */
export interface DiceRoll {
  id: string
  userId: string
  userName: string
  /** Например: ['d20', 'd6'] */
  dice: string[]
  /** Результат по каждому кубику (в том же порядке) */
  results: number[]
  total: number
  timestamp: number
}

/** Участник, подключённый к сессии (runtime-данные сервера) */
export interface PlayerInfo {
  id: string
  name: string
  role: PlayerRole
  /** Цвет метки участника (для чата и курсоров) */
  color: string
}

/** Состояние сессии (сохраняется в JSON-файл, формат задан ТЗ) */
export interface Session {
  /** Версия схемы JSON — для миграций при загрузке старых файлов */
  schemaVersion: 1
  id: string
  name: string
  /** Описание сессии (ТЗ: «Создание новой сессии (имя, описание)») */
  description: string
  createdAt: number
  /** Время последнего автосохранения */
  updatedAt: number
  map: MapData
  tokens: Token[]
  fogOfWar: FogOfWarData
  drawings: Drawing[]
  settings: MapSettings
  /** История чата (ограничена сервером) */
  chatLog: ChatMessage[]
  /** История бросков (ТЗ, п.6: «История бросков») */
  rollLog: DiceRoll[]
}

/** Краткая информация о сессии для списка в UI Мастера */
export interface SessionSummary {
  id: string
  name: string
  description: string
  createdAt: number
  updatedAt: number
  tokenCount: number
  hasMap: boolean
}

/** Публичная часть сессии, которую получает игрок (без скрытых токенов) */
export type SessionView = Session
