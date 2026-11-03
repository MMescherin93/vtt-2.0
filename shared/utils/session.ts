import type { Session } from '../types/session'
import { BUILT_IN_EXTENSIONS } from '../plugins/builtins'
import { defaultExtensionValues } from '../plugins/types'
import { DEFAULT_MAP_SETTINGS } from './grid'

/** Создаёт пустую сессию (используется при создании новой сессии хостом) */
export function createSessionState(
  id: string,
  name: string,
  description: string,
  now = Date.now()
): Session {
  return {
    schemaVersion: 2,
    id,
    name,
    description,
    createdAt: now,
    updatedAt: now,
    maps: [],
    tokens: [],
    fogOfWar: { covered: true, ops: [] },
    drawings: [],
    settings: { ...DEFAULT_MAP_SETTINGS },
    enabledExtensions: defaultExtensionValues(BUILT_IN_EXTENSIONS),
    extensionState: {},
    chatLog: [],
    rollLog: []
  }
}

/** Максимальная длина истории чата и бросков, хранимой в JSON сессии */
export const MAX_CHAT_LOG = 500
export const MAX_ROLL_LOG = 200

/** Безопасно обрезает историю, чтобы файл сессии не разрастался */
export function trimLog<T>(items: T[], limit: number): T[] {
  return items.length > limit ? items.slice(items.length - limit) : items
}
