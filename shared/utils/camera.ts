/** Камера клиента: независима у каждого участника (уточнение 2) */
export interface Camera {
  /** Смещение мира в экранных пикселях */
  x: number
  y: number
  /** Масштаб: 1 — пиксель карты = экранный пиксель */
  scale: number
}

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export const MIN_SCALE = 0.05
export const MAX_SCALE = 8

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

/** Масштабирование колесом относительно курсора (экранные координаты точки) */
export function zoomAt(camera: Camera, factor: number, pointer: Point): Camera {
  const scale = clampScale(camera.scale * factor)
  const ratio = scale / camera.scale
  return {
    x: pointer.x - (pointer.x - camera.x) * ratio,
    y: pointer.y - (pointer.y - camera.y) * ratio,
    scale
  }
}

export function screenToWorld(camera: Camera, point: Point): Point {
  return { x: (point.x - camera.x) / camera.scale, y: (point.y - camera.y) / camera.scale }
}

export function worldToScreen(camera: Camera, point: Point): Point {
  return { x: point.x * camera.scale + camera.x, y: point.y * camera.scale + camera.y }
}

/**
 * Ограничивает камеру так, чтобы карта не «уезжала» за пределы экрана.
 * Камера НЕ центрируется автоматически: если карта меньше вьюпорта, её можно
 * двигать, но хотя бы часть остаётся видимой. Центрирование — только кнопкой
 * «Вписать» (`fitCamera`).
 */
export function clampCamera(camera: Camera, viewport: Size, map: Size, margin = 80): Camera {
  const scale = clampScale(camera.scale)
  const scaledWidth = map.width * scale
  const scaledHeight = map.height * scale

  let x = camera.x
  let y = camera.y

  if (scaledWidth > viewport.width) {
    x = Math.min(margin, Math.max(viewport.width - scaledWidth - margin, x))
  } else {
    // Не центрируем: держим в кадре хотя бы margin пикселей карты
    x = Math.min(viewport.width - margin, Math.max(margin - scaledWidth, x))
  }

  if (scaledHeight > viewport.height) {
    y = Math.min(margin, Math.max(viewport.height - scaledHeight - margin, y))
  } else {
    y = Math.min(viewport.height - margin, Math.max(margin - scaledHeight, y))
  }

  return { x, y, scale }
}

/** Вписывает карту во вьюпорт с отступом (используется при загрузке карты) */
export function fitCamera(viewport: Size, map: Size, padding = 40): Camera {
  if (map.width <= 0 || map.height <= 0) {
    return { x: 0, y: 0, scale: 1 }
  }
  const scale = clampScale(
    Math.min(
      (viewport.width - padding * 2) / map.width,
      (viewport.height - padding * 2) / map.height
    )
  )
  return {
    x: (viewport.width - map.width * scale) / 2,
    y: (viewport.height - map.height * scale) / 2,
    scale
  }
}

/** Ограничение точки пределами карты */
export function clampToMap(point: Point, map: Size): Point {
  return {
    x: Math.min(map.width, Math.max(0, point.x)),
    y: Math.min(map.height, Math.max(0, point.y))
  }
}
