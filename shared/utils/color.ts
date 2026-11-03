import { hashString } from './ids'

/** Палитра цветов участников (акцентные, хорошо читаемые на тёмном фоне) */
export const PLAYER_COLORS = [
  '#818cf8',
  '#34d399',
  '#f472b6',
  '#fbbf24',
  '#38bdf8',
  '#a78bfa',
  '#fb7185',
  '#4ade80',
  '#facc15',
  '#22d3ee'
] as const

/** Цвет для участника по его идентификатору/имени */
export function colorForPlayer(key: string): string {
  return PLAYER_COLORS[hashString(key) % PLAYER_COLORS.length]!
}
