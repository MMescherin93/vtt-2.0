import type { Camera } from '../../utils/camera'

const PREFIX = 'vtt.camera.'

function storageKey(key: string): string {
  return `${PREFIX}${key}`
}

/** Сохранённая камера клиента (уточнение 2: восстанавливается локально) */
export function loadCamera(key: string): Camera | null {
  try {
    const raw = localStorage.getItem(storageKey(key))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Camera>
    if (
      typeof parsed.x === 'number' &&
      typeof parsed.y === 'number' &&
      typeof parsed.scale === 'number' &&
      Number.isFinite(parsed.x) &&
      Number.isFinite(parsed.y) &&
      Number.isFinite(parsed.scale)
    ) {
      return { x: parsed.x, y: parsed.y, scale: parsed.scale }
    }
  } catch {
    // повреждённое значение игнорируем
  }
  return null
}

export function saveCamera(key: string, camera: Camera): void {
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(camera))
  } catch {
    // localStorage недоступен — не критично
  }
}

export function clearCamera(key: string): void {
  try {
    localStorage.removeItem(storageKey(key))
  } catch {
    // игнорируем
  }
}
