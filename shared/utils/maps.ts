import type { MapAsset, MapLayout } from '../types/map'

/** Зазор между картами на общем полотне (пустое тёмное поле) */
export const MAP_GAP = 120

export interface MapPlacement {
  map: MapAsset
  /** Левый верхний угол карты без поворота (уже с учётом масштаба) */
  x: number
  y: number
  /** Размер карты с учётом масштаба */
  width: number
  height: number
  /** Поворот вокруг центра, градусы */
  rotation: number
  scale: number
  /** Габариты повёрнутой карты (AABB) */
  boundsWidth: number
  boundsHeight: number
}

export interface WorldLayout {
  items: MapPlacement[]
  /** Размер всего полотна (карты + зазоры) */
  world: { width: number; height: number }
}

const MIN_MAP_SCALE = 0.25
const MAX_MAP_SCALE = 4

function normalizeRotation(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0
  const normalized = ((value ?? 0) % 360 + 360) % 360
  return normalized > 180 ? normalized - 360 : normalized
}

function normalizeScale(value: number | undefined): number {
  if (!Number.isFinite(value) || !value) return 1
  return Math.min(MAX_MAP_SCALE, Math.max(MIN_MAP_SCALE, value))
}

/**
 * Раскладывает карты в ряд или в столбец через зазор.
 * x/y — левый верхний угол неотмасштабированной карты; поворот идёт вокруг
 * центра, поэтому для мира считаются габариты AABB.
 * Токены, туман и рисунки живут в координатах этого мира.
 */
export function layoutMaps(
  maps: MapAsset[],
  gap: number = MAP_GAP,
  layout: MapLayout = 'horizontal'
): WorldLayout {
  const items: MapPlacement[] = []
  let cursor = 0
  let worldWidth = 0
  let worldHeight = 0

  maps.forEach((map, index) => {
    if (index > 0) cursor += gap

    const scale = normalizeScale(map.scale)
    const width = Math.max(1, map.width * scale)
    const height = Math.max(1, map.height * scale)
    const rotation = normalizeRotation(map.rotation)
    const radians = (rotation * Math.PI) / 180
    const boundsWidth = Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians))
    const boundsHeight = Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians))

    const x =
      layout === 'vertical' ? (boundsWidth - width) / 2 : cursor + (boundsWidth - width) / 2
    const y =
      layout === 'vertical' ? cursor + (boundsHeight - height) / 2 : (boundsHeight - height) / 2

    items.push({
      map,
      x,
      y,
      width,
      height,
      rotation,
      scale,
      boundsWidth,
      boundsHeight
    })

    cursor += layout === 'vertical' ? boundsHeight : boundsWidth
    worldWidth = Math.max(worldWidth, x + width + (boundsWidth - width) / 2)
    worldHeight = Math.max(worldHeight, y + height + (boundsHeight - height) / 2)
  })

  return { items, world: { width: worldWidth, height: worldHeight } }
}

/** Размер мира для карт (0×0, если карт нет) */
export function worldSize(
  maps: MapAsset[],
  gap: number = MAP_GAP,
  layout: MapLayout = 'horizontal'
): { width: number; height: number } {
  return layoutMaps(maps, gap, layout).world
}

/** Центр мира — удобная точка для новых токенов */
export function worldCenter(
  maps: MapAsset[],
  fallback: { x: number; y: number } = { x: 960, y: 540 },
  layout: MapLayout = 'horizontal'
): { x: number; y: number } {
  const world = worldSize(maps, MAP_GAP, layout)
  if (world.width <= 0 || world.height <= 0) return fallback
  return { x: world.width / 2, y: world.height / 2 }
}
