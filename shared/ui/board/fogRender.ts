import type { FogOfWarData } from '../../types/map'

/** Цвет тумана (совпадает с фоном карты) */
export const FOG_RGB = { r: 8, g: 10, b: 16 }
export const FOG_COLOR = `rgba(${FOG_RGB.r}, ${FOG_RGB.g}, ${FOG_RGB.b}, 1)`

/**
 * Отрисовывает туман войны на offscreen-канве.
 * Базовое состояние (covered) заливает всю карту, затем операции применяются
 * строго по порядку: reveal стирает туман (destination-out), conceal — закрашивает.
 */
export function renderFog(
  context: CanvasRenderingContext2D,
  fog: FogOfWarData,
  width: number,
  height: number
): void {
  context.save()
  context.clearRect(0, 0, width, height)
  context.globalCompositeOperation = 'source-over'
  context.fillStyle = FOG_COLOR
  context.strokeStyle = FOG_COLOR
  context.lineCap = 'round'
  context.lineJoin = 'round'

  if (fog.covered) {
    context.fillRect(0, 0, width, height)
  }

  for (const op of fog.ops) {
    context.globalCompositeOperation = op.op === 'reveal' ? 'destination-out' : 'source-over'
    if (op.shape === 'rect') {
      context.fillRect(op.x, op.y, op.width, op.height)
      continue
    }
    if (op.points.length < 2) continue
    context.beginPath()
    context.lineWidth = op.size
    context.moveTo(op.points[0]!, op.points[1]!)
    for (let i = 2; i < op.points.length; i += 2) {
      context.lineTo(op.points[i]!, op.points[i + 1]!)
    }
    context.stroke()
  }

  context.restore()
}

/** Есть ли что рисовать (иначе слой можно не создавать) */
export function fogHasContent(fog: FogOfWarData): boolean {
  return fog.covered || fog.ops.length > 0
}
