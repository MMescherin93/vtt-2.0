import { useEffect, useState } from 'react'

interface DecodedFrame {
  image: {
    displayWidth: number
    displayHeight: number
    close: () => void
  }
}

interface GifDecoder {
  tracks: {
    ready: Promise<void>
    selectedTrack: { frameCount: number } | null
  }
  decode: (options: { frameIndex: number }) => Promise<DecodedFrame>
  close: () => void
}

type ImageDecoderConstructor = new (init: {
  data: ArrayBuffer
  type: string
}) => GifDecoder

const FRAME_DELAY_MS = 33

/**
 * Декодирует анимированный GIF в canvas.
 *
 * В Electron HTMLImageElement с GIF может отдавать только первый кадр в
 * Konva.Image, поэтому кадры берём через WebCodecs ImageDecoder и рисуем на
 * canvas. MapLayer перерисовывает слой, а здесь меняется содержимое canvas.
 */
export function useGifCanvas(url: string, enabled: boolean): HTMLCanvasElement | null {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)

  useEffect(() => {
    setCanvas(null)
    if (!enabled || !url) return

    const Constructor = (
      window as unknown as { ImageDecoder?: ImageDecoderConstructor }
    ).ImageDecoder
    if (!Constructor) return

    let cancelled = false
    let decoder: GifDecoder | null = null
    let timer = 0
    const controller = new AbortController()

    const start = async (): Promise<void> => {
      try {
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) return
        const data = await response.arrayBuffer()
        if (cancelled) return

        decoder = new Constructor({ data, type: 'image/gif' })
        await decoder.tracks.ready
        const count = decoder.tracks.selectedTrack?.frameCount ?? 0
        if (count < 2 || cancelled) return

        const first = await decoder.decode({ frameIndex: 0 })
        const width = first.image.displayWidth
        const height = first.image.displayHeight
        if (!width || !height) {
          first.image.close()
          return
        }

        const next = document.createElement('canvas')
        next.width = width
        next.height = height
        const context = next.getContext('2d')
        if (!context) {
          first.image.close()
          return
        }

        context.drawImage(first.image as unknown as CanvasImageSource, 0, 0, width, height)
        first.image.close()
        if (cancelled) return
        setCanvas(next)

        let index = 1
        const tick = async (): Promise<void> => {
          if (cancelled || !decoder) return
          try {
            const frame = await decoder.decode({ frameIndex: index })
            if (cancelled) {
              frame.image.close()
              return
            }
            context.drawImage(frame.image as unknown as CanvasImageSource, 0, 0, width, height)
            frame.image.close()
            index = (index + 1) % count
          } catch {
            // битый кадр — просто ждём следующий тик
          }
          if (!cancelled) timer = window.setTimeout(() => void tick(), FRAME_DELAY_MS)
        }

        timer = window.setTimeout(() => void tick(), FRAME_DELAY_MS)
      } catch {
        // нет ImageDecoder / GIF не загрузился — останется обычная картинка
      }
    }

    void start()

    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(timer)
      decoder?.close()
    }
  }, [url, enabled])

  return canvas
}
