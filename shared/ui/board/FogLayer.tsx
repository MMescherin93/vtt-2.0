import { Layer, Line, Rect } from 'react-konva'
import type { FogOfWarData } from '../../types/map'
import { FOG_COLOR, fogHasContent } from './fogRender'

export interface FogLayerProps {
  fog: FogOfWarData
  width: number
  height: number
  /** 1 — игроки ничего не видят под туманом; 0.35 — превью для Мастера */
  opacity: number
  visible: boolean
}

/**
 * Слой тумана войны (ТЗ, п.4).
 *
 * Рисуется векторно, без offscreen-канвы: так мир из нескольких карт
 * (десятки тысяч пикселей в ширину) не съедает память. `destination-out`
 * стирает туман только внутри этого слоя, не трогая карту и токены.
 */
export function FogLayer({ fog, width, height, opacity, visible }: FogLayerProps) {
  if (!visible || !fogHasContent(fog) || width <= 0 || height <= 0) return null

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
