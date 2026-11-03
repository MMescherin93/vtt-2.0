import { useEffect, useRef } from 'react'
import type Konva from 'konva'
import { Image as KonvaImage, Layer } from 'react-konva'
import type { FogOfWarData } from '../../types/map'
import { fogHasContent, renderFog } from './fogRender'

export interface FogLayerProps {
  fog: FogOfWarData
  width: number
  height: number
  /** 1 — игроки ничего не видят под туманом; 0.35 — превью для Мастера */
  opacity: number
  visible: boolean
}

/** Слой тумана войны (ТЗ, п.4) */
export function FogLayer({ fog, width, height, opacity, visible }: FogLayerProps) {
  const layerRef = useRef<Konva.Layer>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  if (!canvasRef.current && typeof document !== 'undefined') {
    canvasRef.current = document.createElement('canvas')
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width <= 0 || height <= 0) return
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    const context = canvas.getContext('2d')
    if (!context) return
    renderFog(context, fog, width, height)
    // Канва меняется вне React — просим Konva перерисовать слой
    layerRef.current?.batchDraw()
  }, [fog, width, height, visible, opacity])

  if (!visible || !fogHasContent(fog) || width <= 0 || height <= 0) return null

  return (
    <Layer ref={layerRef} listening={false} opacity={opacity}>
      <KonvaImage
        image={canvasRef.current ?? undefined}
        x={0}
        y={0}
        width={width}
        height={height}
        listening={false}
      />
    </Layer>
  )
}
