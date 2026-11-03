import { Layer, Line } from 'react-konva'
import type { Drawing } from '../../types/map'

export interface DrawingsLayerProps {
  drawings: Drawing[]
  width: number
  height: number
}

/**
 * Слой рисунков (ТЗ, п.5). Инструмент «ластик» реализован как линия с
 * композитным режимом destination-out: он стирает ранее нарисованное,
 * не затрагивая карту и токены (они лежат в других слоях).
 */
export function DrawingsLayer({ drawings, width, height }: DrawingsLayerProps) {
  return (
    <Layer listening={false} clipX={0} clipY={0} clipWidth={width} clipHeight={height}>
      {drawings.map((drawing) => (
        <Line
          key={drawing.id}
          points={drawing.points}
          stroke={drawing.tool === 'eraser' ? '#000' : drawing.color}
          strokeWidth={drawing.size}
          lineCap="round"
          lineJoin="round"
          perfectDrawEnabled={false}
          globalCompositeOperation={drawing.tool === 'eraser' ? 'destination-out' : 'source-over'}
          listening={false}
        />
      ))}
    </Layer>
  )
}
