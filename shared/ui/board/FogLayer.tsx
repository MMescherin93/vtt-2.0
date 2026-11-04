import { useMemo } from 'react'
import { Layer, Line, Rect, Shape } from 'react-konva'
import type { FogOfWarData } from '../../types/map'
import { FOG_COLOR, FOG_RGB, fogHasContent } from './fogRender'

export interface FogLayerProps {
  fog: FogOfWarData
  width: number
  height: number
  /** 1 — игроки ничего не видят под туманом; 0.45 — затемнение у Мастера */
  opacity: number
  visible: boolean
  /** Бинарное превью (Мастер): только «туман» или «просвет», без полутонов */
  binary?: boolean
  camera?: { x: number; y: number; scale: number }
  viewport?: { width: number; height: number }
}

/** Доля разрешения экранной маски: 0.7 достаточно и не тормозит панорамирование */
const MASK_SCALE = 0.7

/**
 * Экранная бинарная маска тумана для превью Мастера.
 *
 * Векторный слой при полупрозрачности показывал полутона по краям мазков:
 * многократный `destination-out` «съедал» альфу на стыках, и после ластика
 * оставались серые следы. Здесь маска один раз растеризуется в разрешении
 * экрана и альфа обрезается по порогу: пиксель либо полностью туман, либо
 * полностью прозрачен.
 */
function BinaryFog({
  fog,
  camera,
  viewport
}: {
  fog: FogOfWarData
  camera: { x: number; y: number; scale: number }
  viewport: { width: number; height: number }
}) {
  const view = useMemo(() => {
    const scale = Math.max(0.01, camera.scale)
    return {
      x: -camera.x / scale,
      y: -camera.y / scale,
      w: viewport.width / scale,
      h: viewport.height / scale,
      scale
    }
  }, [camera.x, camera.y, camera.scale, viewport.width, viewport.height])

  const mask = useMemo(() => {
    const cw = Math.max(1, Math.round(viewport.width * MASK_SCALE))
    const ch = Math.max(1, Math.round(viewport.height * MASK_SCALE))

    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return canvas

    const scale = view.scale * MASK_SCALE
    context.setTransform(scale, 0, 0, scale, -view.x * scale, -view.y * scale)
    context.fillStyle = FOG_COLOR
    context.strokeStyle = FOG_COLOR
    context.lineCap = 'round'
    context.lineJoin = 'round'

    if (fog.covered) {
      context.fillRect(view.x, view.y, view.w, view.h)
    }

    for (const op of fog.ops) {
      context.globalCompositeOperation = op.op === 'reveal' ? 'destination-out' : 'source-over'
      if (op.shape === 'rect') {
        context.fillRect(op.x, op.y, op.width, op.height)
        continue
      }
      if (op.points.length < 2) continue
      context.lineWidth = op.size
      context.beginPath()
      context.moveTo(op.points[0]!, op.points[1]!)
      for (let i = 2; i < op.points.length; i += 2) {
        context.lineTo(op.points[i]!, op.points[i + 1]!)
      }
      context.stroke()
    }

    // Порог по альфе: убираем полутона и накопленные артефакты ластика
    const image = context.getImageData(0, 0, cw, ch)
    const data = image.data
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] >= 128) {
        data[i] = FOG_RGB.r
        data[i + 1] = FOG_RGB.g
        data[i + 2] = FOG_RGB.b
        data[i + 3] = 255
      } else {
        data[i + 3] = 0
      }
    }
    context.putImageData(image, 0, 0)

    return canvas
  }, [fog, view, viewport.width, viewport.height])

  return (
    <Shape
      listening={false}
      perfectDrawEnabled={false}
      sceneFunc={(context) => {
        // Без сглаживания: иначе при масштабировании бинарная маска
        // снова даёт серые пиксели на границах
        const raw = (context as unknown as { _context?: CanvasRenderingContext2D })._context
        if (raw) raw.imageSmoothingEnabled = false
        context.drawImage(mask, view.x, view.y, view.w, view.h)
      }}
    />
  )
}

/**
 * Слой тумана войны (ТЗ, п.4).
 *
 * У игроков — плотный векторный слой (мир из нескольких карт может быть
 * очень широким, offscreen-канва на весь мир не нужна). У Мастера в режиме
 * «туман виден» — бинарная экранная маска, чтобы не было серых следов.
 * В режиме «туман скрыт» Мастер видит те же области полупрозрачным
 * затемнением — карта и токены остаются читаемыми.
 */
export function FogLayer({
  fog,
  width,
  height,
  opacity,
  visible,
  binary = false,
  camera,
  viewport
}: FogLayerProps) {
  if (!visible || !fogHasContent(fog) || width <= 0 || height <= 0) return null

  if (binary && camera && viewport && viewport.width > 0 && viewport.height > 0) {
    return (
      <Layer listening={false}>
        <BinaryFog fog={fog} camera={camera} viewport={viewport} />
      </Layer>
    )
  }

  return (
    <Layer listening={false} opacity={opacity}>
      {fog.covered && (
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill={FOG_COLOR}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {fog.ops.map((op) =>
        op.shape === 'rect' ? (
          <Rect
            key={op.id}
            x={op.x}
            y={op.y}
            width={op.width}
            height={op.height}
            fill={FOG_COLOR}
            globalCompositeOperation={op.op === 'reveal' ? 'destination-out' : 'source-over'}
            listening={false}
            perfectDrawEnabled={false}
          />
        ) : (
          <Line
            key={op.id}
            points={op.points}
            stroke={FOG_COLOR}
            strokeWidth={op.size}
            lineCap="round"
            lineJoin="round"
            globalCompositeOperation={op.op === 'reveal' ? 'destination-out' : 'source-over'}
            listening={false}
            perfectDrawEnabled={false}
          />
        )
      )}
    </Layer>
  )
}
