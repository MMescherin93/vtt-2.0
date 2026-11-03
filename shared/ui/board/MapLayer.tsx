import { Image as KonvaImage, Layer, Rect, Text } from 'react-konva'
import type { MapPlacement } from '../../utils/maps'
import { assetUrl } from '../assets'
import { useImage } from '../useImage'

export interface MapLayerProps {
  sessionId: string
  assetsBaseUrl: string
  /** Карты, разложенные по общему полотну (слева направо через зазор) */
  placements: MapPlacement[]
  width: number
  height: number
  /** Есть ли хотя бы одна карта (иначе рисуем заглушку) */
  hasMaps: boolean
  /** Есть ли право загрузить карту (GM) — влияет на текст подсказки */
  canUpload: boolean
}

function MapImage({
  placement,
  sessionId,
  assetsBaseUrl
}: {
  placement: MapPlacement
  sessionId: string
  assetsBaseUrl: string
}) {
  const { map, x, y } = placement
  const url = assetUrl(assetsBaseUrl, sessionId, map.imageUrl)
  const { image, error } = useImage(url)

  return (
    <>
      <Rect x={x} y={y} width={map.width} height={map.height} fill="#10131b" />
      {image && <KonvaImage image={image} x={x} y={y} width={map.width} height={map.height} />}
      {!image && (
        <Text
          x={x}
          y={y + map.height / 2 - 10}
          width={map.width}
          align="center"
          text={error ? 'Не удалось загрузить карту' : 'Загрузка карты…'}
          fontSize={16}
          fill="#6b7280"
        />
      )}
      {/* Тонкая рамка, чтобы карты читались на тёмном полотне */}
      <Rect
        x={x}
        y={y}
        width={map.width}
        height={map.height}
        stroke="rgba(255, 255, 255, 0.08)"
        strokeWidth={2}
        listening={false}
      />
    </>
  )
}

/** Слой карт: все карты сессии на общем тёмном полотне с зазорами */
export function MapLayer({
  sessionId,
  assetsBaseUrl,
  placements,
  width,
  height,
  hasMaps,
  canUpload
}: MapLayerProps) {
  return (
    <Layer listening={false}>
      <Rect x={0} y={0} width={width} height={height} fill="#0b0d12" />

      {placements.map((placement) => (
        <MapImage
          key={placement.map.id}
          placement={placement}
          sessionId={sessionId}
          assetsBaseUrl={assetsBaseUrl}
        />
      ))}

      {!hasMaps && (
        <>
          <Text
            x={0}
            y={height / 2 - 56}
            width={width}
            align="center"
            text="Карты не загружены"
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
