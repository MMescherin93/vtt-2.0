import { Image as KonvaImage, Layer, Rect, Text } from 'react-konva'
import { useImage } from '../useImage'

export interface MapLayerProps {
  imageUrl: string
  width: number
  height: number
  /** Загружена ли карта в сессии (иначе рисуем заглушку) */
  hasMap: boolean
  /** Есть ли право загрузить карту (GM) — влияет на текст подсказки */
  canUpload: boolean
}

/** Слой изображения карты (ТЗ, п.2) */
export function MapLayer({ imageUrl, width, height, hasMap, canUpload }: MapLayerProps) {
  const { image } = useImage(imageUrl)

  return (
    <Layer listening={false}>
      <Rect x={0} y={0} width={width} height={height} fill="#0b0d12" />
      {image && <KonvaImage image={image} x={0} y={0} width={width} height={height} />}
      {hasMap && !image && (
        <Text
          x={0}
          y={height / 2 - 12}
          width={width}
          align="center"
          text="Загрузка карты…"
          fontSize={18}
          fill="#6b7280"
        />
      )}
      {!hasMap && (
        <>
          <Text
            x={0}
            y={height / 2 - 56}
            width={width}
            align="center"
            text="Карта не загружена"
            fontSize={28}
            fontStyle="bold"
            fill="#374151"
          />
          <Text
            x={0}
            y={height / 2 - 16}
            width={width}
            align="center"
            text={
              canUpload
                ? 'Перетащите изображение сюда или загрузите через панель «Карта»'
                : 'Мастер ещё не загрузил карту'
            }
            fontSize={16}
            fill="#4b5563"
          />
        </>
      )}
    </Layer>
  )
}
