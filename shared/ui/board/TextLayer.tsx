import { Layer, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { MapText } from '../../types/map'

export interface TextLayerProps {
  texts: MapText[]
  width: number
  height: number
  interactive: boolean
  selectedTextId: string | null
  onSelect: (textId: string | null) => void
  onMove: (textId: string, x: number, y: number) => void
  onEdit: (text: MapText) => void
}

/** Текст на карте: перетаскивание и двойной клик для правки */
export function TextLayer({
  texts,
  width,
  height,
  interactive,
  selectedTextId,
  onSelect,
  onMove,
  onEdit
}: TextLayerProps) {
  return (
    <Layer listening={interactive} clipX={0} clipY={0} clipWidth={width} clipHeight={height}>
      {texts.map((item) => {
        return (
          <Text
            key={item.id}
            x={item.x}
            y={item.y}
            text={item.text}
            fontSize={item.fontSize}
            fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
            fontStyle="600"
            fill={item.color}
            lineHeight={1.2}
            draggable={interactive}
            perfectDrawEnabled={false}
            onMouseDown={(event: KonvaEventObject<MouseEvent>) => {
              event.cancelBubble = true
              onSelect(item.id)
            }}
            onDblClick={(event: KonvaEventObject<MouseEvent>) => {
              event.cancelBubble = true
              onEdit(item)
            }}
            onDblTap={(event: KonvaEventObject<Event>) => {
              event.cancelBubble = true
              onEdit(item)
            }}
            onDragEnd={(event: KonvaEventObject<DragEvent>) => {
              const node = event.target as Konva.Text
              onMove(item.id, node.x(), node.y())
            }}
          />
        )
      })}

      {texts
        .filter((item) => item.id === selectedTextId)
        .map((item) => {
          const lines = item.text.split('\n')
          const approxWidth =
            Math.max(1, ...lines.map((line) => line.length)) * item.fontSize * 0.58
          const approxHeight = Math.max(1, lines.length) * item.fontSize * 1.25
          return (
            <Rect
              key={`sel-${item.id}`}
              x={item.x - 4}
              y={item.y - 4}
              width={approxWidth + 8}
              height={approxHeight + 8}
              stroke="#818cf8"
              strokeWidth={1.5}
              dash={[5, 4]}
              fill="rgba(129,140,248,0.08)"
              listening={false}
            />
          )
        })}
    </Layer>
  )
}
