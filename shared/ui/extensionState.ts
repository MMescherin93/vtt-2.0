/**
 * Помощники для модулей-расширений: локальный выбор пользователя
 * (например, какой лист открыт) и слияние списков по id, чтобы несколько
 * пользователей могли редактировать разные элементы одновременно.
 */

const SELECTION_PREFIX = 'vtt.ext.selection:'

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function readSelection(extensionId: string): string | null {
  try {
    return storage()?.getItem(`${SELECTION_PREFIX}${extensionId}`) ?? null
  } catch {
    return null
  }
}

export function writeSelection(extensionId: string, id: string): void {
  try {
    storage()?.setItem(`${SELECTION_PREFIX}${extensionId}`, id)
  } catch {
    /* приватный режим */
  }
}

export function listOf(value: unknown, key: string): Array<Record<string, unknown>> {
  if (!value || typeof value !== 'object') return []
  const list = (value as Record<string, unknown>)[key]
  if (!Array.isArray(list)) return []
  return list.filter(
    (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object'
  )
}

/** Подставляет локальный выбор (например, текущего листа) в состояние модуля */
export function withLocalSelection(state: unknown, extensionId: string, listKey: string): unknown {
  if (!state || typeof state !== 'object') return state
  const list = listOf(state, listKey)
  if (list.length === 0) return state

  let id = readSelection(extensionId)
  if (!id || !list.some((item) => String(item.id) === id)) {
    const shared = (state as Record<string, unknown>).currentId
    if (typeof shared === 'string' && list.some((item) => String(item.id) === shared)) {
      id = shared
      writeSelection(extensionId, shared)
    }
  }
  // Выбранный ранее элемент удалили — показываем первый доступный
  if (!id || !list.some((item) => String(item.id) === id)) {
    const first = list[0]
    if (first && first.id !== undefined) {
      id = String(first.id)
      writeSelection(extensionId, id)
    }
  }
  if (!id) return state
  return { ...(state as Record<string, unknown>), currentId: id }
}

/**
 * Сливает массив по id: элементы, которые клиент не менял, берём из общего
 * состояния. Так два пользователя могут редактировать разные листы, не
 * затирая правки друг друга.
 */
export function mergeWithBaseline(
  baseline: unknown,
  incoming: unknown,
  current: unknown,
  listKey: string
): unknown {
  if (!incoming || typeof incoming !== 'object') return incoming
  const next = { ...(incoming as Record<string, unknown>) }
  if (!Array.isArray(next[listKey])) return incoming

  const baseById = new Map(listOf(baseline, listKey).map((item) => [String(item.id), item]))
  const currentById = new Map(listOf(current, listKey).map((item) => [String(item.id), item]))

  const merged = listOf(incoming, listKey).map((item) => {
    const baseItem = baseById.get(String(item.id))
    const currentItem = currentById.get(String(item.id))
    const unchanged = baseItem && currentItem && JSON.stringify(baseItem) === JSON.stringify(item)
    return unchanged && currentItem ? currentItem : item
  })

  // Новые листы другого пользователя, которых этот клиент ещё не видел
  for (const currentItem of currentById.values()) {
    const id = String(currentItem.id)
    if (!merged.some((item) => String(item.id) === id) && !baseById.has(id)) {
      merged.push(currentItem)
    }
  }

  next[listKey] = merged
  return next
}
