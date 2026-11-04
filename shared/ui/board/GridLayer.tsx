import type { Context } from 'konva/lib/Context'
import { Layer, Shape } from 'react-konva'
import type { GridType } from '../../types/map'
import { hexMetrics } from '../../utils/grid'

export interface VisibleRect {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface GridLayerProps {
  gridType: GridType
  gridSize: number
  showGrid: boolean
  /** Цвет линий сетки в HEX */
  color?: string
  width: number
  height: number
  /** Мастштаб камеры — чтобы линии были толщиной ~1 экранный пиксель */
  cameraScale: number
  view: VisibleRect
}

/** Верхняя граница числа гексов, которые рисуем за кадр (защита от тормозов) */
const MAX_HEXES = 12000

/**
 * Сетка поверх карты (ТЗ, п.2): квадраты / гексы / без сетки,
 * с масштабированием размера ячейки и включением/отключением.
 */
export function GridLayer({
  gridType,
  gridSize,
  showGrid,
  color = '#ffffff',
  width,
  height,
  cameraScale,
  view
}: GridLayerProps) {
  if (!showGrid || gridType === 'none' || gridSize <= 0) return null
  // Слишком мелкая сетка при отдалении только «шумит» — не рисуем
  if (gridSize * cameraScale < 6) return null

  const rgb = color.replace('#', '')
  const stroke =
    rgb.length === 6
      ? `rgba(${parseInt(rgb.slice(0, 2), 16)}, ${parseInt(rgb.slice(2, 4), 16)}, ${parseInt(
          rgb.slice(4, 6),
          16
        )}, 0.3)`
      : 'rgba(255, 255, 255, 0.16)'

  const sceneFunc = (context: Context): void => {
    const lineWidth = 1 / Math.max(cameraScale, 0.05)
    context.setAttr('lineWidth', lineWidth)
    context.setAttr('strokeStyle', stroke)
    context.beginPath()

    if (gridType === 'square') {
      const startX = Math.floor(view.x0 / gridSize) * gridSize
      const startY = Math.floor(view.y0 / gridSize) * gridSize
      for (let x = startX; x <= view.x1; x += gridSize) {
        context.moveTo(x, view.y0)
        context.lineTo(x, view.y1)
      }
      for (let y = startY; y <= view.y1; y += gridSize) {
        context.moveTo(view.x0, y)
        context.lineTo(view.x1, y)
      }
      context.stroke()
      return
    }

    const metrics = hexMetrics(gridSize)
    const { radius, width: hexWidth, colSpacing, rowSpacing } = metrics

    const rowStart = Math.max(0, Math.floor(view.y0 / rowSpacing) - 1)
    const rowEnd = Math.ceil(view.y1 / rowSpacing) + 1
    let drawn = 0

    for (let row = rowStart; row <= rowEnd; row += 1) {
      const cy = radius + row * rowSpacing
      if (cy - radius > view.y1) break
      const offset = row % 2 === 1 ? hexWidth / 2 : 0
      const colStart = Math.max(0, Math.floor((view.x0 - offset) / colSpacing) - 1)
      const colEnd = Math.ceil((view.x1 - offset) / colSpacing) + 1

      for (let col = colStart; col <= colEnd; col += 1) {
        const cx = hexWidth / 2 + col * colSpacing + offset
        if (cx + hexWidth / 2 < view.x0) continue
        if (drawn >= MAX_HEXES) break
        drawn += 1

        for (let vertex = 0; vertex < 6; vertex += 1) {
          const angle = (Math.PI / 180) * (60 * vertex - 90)
          const vx = cx + radius * Math.cos(angle)
          const vy = cy + radius * Math.sin(angle)
          if (vertex === 0) context.moveTo(vx, vy)
          else context.lineTo(vx, vy)
        }
        context.closePath()
      }
    }

    context.stroke()
  }

  return (
    <Layer listening={false} clipX={0} clipY={0} clipWidth={width} clipHeight={height}>
      <Shape sceneFunc={sceneFunc} />
    </Layer>
  )
}
