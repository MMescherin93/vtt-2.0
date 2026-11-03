import { colorForPlayer } from '../../utils/color'

const cache = new Map<string, HTMLCanvasElement>()

/**
 * Заглушка изображения токена (если загружен только имя):
 * круг с первой буквой имени. Кэшируется, чтобы не перерисовывать.
 */
export function tokenPlaceholder(name: string): HTMLCanvasElement {
  const key = name.trim() || '?'
  const cached = cache.get(key)
  if (cached) return cached

  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (context) {
    const color = colorForPlayer(key)
    const gradient = context.createRadialGradient(
      size / 2,
      size / 2,
      20,
      size / 2,
      size / 2,
      size / 2
    )
    gradient.addColorStop(0, color)
    gradient.addColorStop(1, '#1f2333')
    context.beginPath()
    context.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2)
    context.fillStyle = gradient
    context.fill()
    context.lineWidth = 10
    context.strokeStyle = 'rgba(255,255,255,0.35)'
    context.stroke()

    const letter = key.slice(0, 1).toUpperCase()
    context.fillStyle = '#f8fafc'
    context.font = 'bold 130px system-ui, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(letter, size / 2, size / 2 + 6)
  }

  cache.set(key, canvas)
  return canvas
}
