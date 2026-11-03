/**
 * Расширения (плагины) стола.
 *
 * Каждое расширение — самостоятельный модуль с манифестом. Значения
 * включённости хранятся у клиента и переживают перезагрузку страницы.
 * Ядро не знает о конкретных расширениях: интерфейс собирает список
 * из реестра и спрашивает `isExtensionEnabled`.
 */

/** Для кого доступно расширение */
export type ExtensionScope = 'both' | 'gm' | 'player'

/** Манифест расширения (слот `extension`) */
export interface ExtensionDefinition {
  id: string
  title: string
  description: string
  scope: ExtensionScope
  defaultEnabled: boolean
  /** Путь к иконке модуля на HTTP-сервере хоста (например, /extensions/x/icon.svg) */
  icon?: string
  /** Есть ли разворачиваемая панель: такой модуль получает иконку в доке справа сверху */
  panel?: boolean
  /** Могут ли игроки сохранять состояние модуля (иначе пишет только Мастер) */
  playerWritable?: boolean
  /** Ключ метаданных Owlbear, под которым модуль хранит состояние */
  metaKey?: string
}

/** Включённость расширений по id */
export type ExtensionValues = Record<string, boolean>

/** Значения по умолчанию для реестра */
export function defaultExtensionValues(definitions: ExtensionDefinition[]): ExtensionValues {
  return Object.fromEntries(definitions.map((item) => [item.id, item.defaultEnabled]))
}

/** Включено ли расширение с учётом значения по умолчанию */
export function isExtensionEnabled(
  values: ExtensionValues,
  definitions: ExtensionDefinition[],
  id: string
): boolean {
  const definition = definitions.find((item) => item.id === id)
  if (!definition) return true
  return values[id] ?? definition.defaultEnabled
}

/** Доступно ли расширение роли */
export function isExtensionVisible(
  definition: ExtensionDefinition,
  role: 'gm' | 'player'
): boolean {
  return definition.scope === 'both' || definition.scope === role
}
