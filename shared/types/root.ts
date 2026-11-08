import type { RootStat } from '../utils/rootDice'

export type RootMoveCategory =
  | 'basic'
  | 'weapon'
  | 'travel'
  | 'session'
  | 'reputation'
  | 'playbook'
  | 'custom'

export interface RootMove {
  id: string
  name: string
  category: RootMoveCategory
  stat?: RootStat
  text: string
}

export interface RootMovesLibrary {
  version: 1
  moves: RootMove[]
}

export const ROOT_MOVE_CATEGORIES: Array<{ id: RootMoveCategory; label: string }> = [
  { id: 'basic', label: 'Базовые' },
  { id: 'weapon', label: 'Оружейные' },
  { id: 'travel', label: 'Дорожные' },
  { id: 'session', label: 'Сессионные' },
  { id: 'reputation', label: 'Репутация' },
  { id: 'playbook', label: 'Плейбуки' },
  { id: 'custom', label: 'Свои' }
]

export function rootMoveCategoryLabel(category: RootMoveCategory): string {
  return ROOT_MOVE_CATEGORIES.find((item) => item.id === category)?.label ?? 'Свои'
}
