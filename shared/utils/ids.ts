/**
 * Генерация идентификаторов (работает и в Node, и в браузере).
 * crypto.randomUUID доступен в Node >= 19 и во всех современных браузерах.
 */
export function newId(prefix?: string): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return prefix ? `${prefix}_${uuid}` : uuid
}

/** Короткий идентификатор (для ссылок-приглашений и папок сессий) */
export function shortId(length = 10): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  const bytes = new Uint8Array(length)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i]! % alphabet.length]
  return out
}

/** Простой детерминированный хэш строки (для выбора цвета участника) */
export function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}
