import type { MapAsset } from '../types/map'

/** Зазор между картами на общем полотне (пустое тёмное поле) */
export const MAP_GAP = 120

export interface MapPlacement {
  map: MapAsset
  /** Смещение карты на полотне мира */
  x: number
  y: number
}

export interface WorldLayout {
  items: MapPlacement[]
  /** Размер всего полотна (карты + зазоры) */
  world: { width: number; height: number }
}

/**
 * Раскладывает карты слева направо через зазор.
 * Токены, туман и рисунки живут в координатах этого мира.
 */
export function layoutMaps(maps: MapAsset[], gap: number = MAP_GAP): WorldLayout {
  const items: MapPlacement[] = []
  let cursor = 0
  let height = 0

  maps.forEach((map, index) => {
    if (index > 0) cursor += gap
    items.push({ map, x: cursor, y: 0 })
    cursor += Math.max(0, map.width)
    height = Math.max(height, map.height)
  })

  return { items, world: { width: cursor, height } }
}

/** Размер мира для карт (0×0, если карт нет) */
export function worldSize(
  maps: MapAsset[],
  gap: number = MAP_GAP
): { width: number; height: number } {
  return layoutMaps(maps, gap).world
}

/** Центр мира — удобная точка для новых токенов */
export function worldCenter(
  maps: MapAsset[],
  fallback: { x: number; y: number } = { x: 960, y: 540 }
): { x: number; y: number } {
  const world = worldSize(maps)
  if (world.width <= 0 || world.height <= 0) return fallback
  return { x: world.width / 2, y: world.height / 2 }
}
