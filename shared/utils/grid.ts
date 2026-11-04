import type { GridType, MapSettings } from '../types/map'

/** Стандартные настройки карты новой сессии */
export const DEFAULT_MAP_SETTINGS: MapSettings = {
  gridType: 'square',
  gridSize: 70,
  showGrid: true,
  gridColor: '#ffffff',
  tokenLabelColor: '#e2e8f0',
  showTokenNames: true
}

export const MIN_GRID_SIZE = 20
export const MAX_GRID_SIZE = 400

export function clampGridSize(size: number): number {
  return Math.min(MAX_GRID_SIZE, Math.max(MIN_GRID_SIZE, Math.round(size)))
}

export const GRID_TYPE_LABELS: Record<GridType, string> = {
  square: 'Квадраты',
  hex: 'Гексы',
  none: 'Без сетки'
}

/** Геометрия гексагональной сетки (pointy-top, как в большинстве VTT) */
export interface HexMetrics {
  /** Радиус описанной окружности (центр → вершина) */
  radius: number
  /** Ширина гекса (между вертикальными сторонами) */
  width: number
  /** Высота гекса (вершина → вершина) */
  height: number
  /** Шаг между центрами по горизонтали */
  colSpacing: number
  /** Шаг между рядами по вертикали */
  rowSpacing: number
}

/**
 * Размер ячейки (gridSize) трактуется как ширина гекса, чтобы ползунок
 * «размер ячейки» вёл себя одинаково для квадратов и гексов.
 */
export function hexMetrics(gridSize: number): HexMetrics {
  const width = gridSize
  const radius = width / Math.sqrt(3)
  return {
    radius,
    width,
    height: radius * 2,
    colSpacing: width,
    rowSpacing: radius * 1.5
  }
}
