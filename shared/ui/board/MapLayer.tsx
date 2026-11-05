import { useEffect, useRef } from 'react'
import { Image as KonvaImage, Layer, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { MapPlacement } from '../../utils/maps'
import { assetUrl } from '../assets'
import { useGifCanvas } from '../useGifCanvas'
import { useImage } from '../useImage'

const GIF_FRAME_MS = 1000 / 30

function isGifMap(imageUrl: string): boolean {
  const clean = imageUrl.split('?')[0]?.toLowerCase() ?? ''
  return clean.endsWith('.gif')
}

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
  const gif = isGifMap(map.imageUrl)
  const gifCanvas = useGifCanvas(url, gif)
  const { image, error } = useImage(url)
  const source = gifCanvas ?? image

  return (
    <>
      <Rect x={x} y={y} width={map.width} height={map.height} fill="#10131b" />
      {source && <KonvaImage image={source} x={x} y={y} width={map.width} height={map.height} />}
      {!source && (
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
  const layerRef = useRef<Konva.Layer | null>(null)
  const hasGif = placements.some((placement) => isGifMap(placement.map.imageUrl))

  // Konva не перерисовывает слой сам по кадрам GIF. Пока на карте есть GIF,
  // обновляем слой с ограничением 30 FPS — иначе браузер показывает первый кадр.
  useEffect(() => {
    const layer = layerRef.current
    if (!layer || !hasGif) return

    let raf = 0
    let previous = 0
    const tick = (time: number): void => {
      if (!previous) previous = time
      if (time - previous >= GIF_FRAME_MS) {
        layer.batchDraw()
        previous = time
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [hasGif])

  return (
    <Layer ref={layerRef} listening={false}>
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
