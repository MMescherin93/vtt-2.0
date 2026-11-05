import { GIFEncoder, applyPalette, quantize } from 'gifenc'

const DEFAULT_MAX_WIDTH = 900
const DEFAULT_MAX_HEIGHT = 900
const DEFAULT_MAX_SECONDS = 15
const DEFAULT_FPS = 12
const MAX_GIF_BYTES = 45 * 1024 * 1024

export interface VideoToGifOptions {
  maxWidth?: number
  maxHeight?: number
  maxSeconds?: number
  fps?: number
  onProgress?: (progress: number) => void
  signal?: AbortSignal
}

export interface VideoToGifResult {
  blob: Blob
  width: number
  height: number
  sourceDuration: number
  duration: number
  frames: number
  trimmed: boolean
}

export function isVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) return true
  return /\.(mp4|webm|mov|m4v|ogv)$/i.test(file.name)
}

function videoDuration(video: HTMLVideoElement): number {
  return Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0
}

function waitForVideoEvent(video: HTMLVideoElement, event: string, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      video.removeEventListener(event, onEvent)
      video.removeEventListener('error', onError)
      signal?.removeEventListener('abort', onAbort)
    }
    const onEvent = (): void => {
      cleanup()
      resolve()
    }
    const onError = (): void => {
      cleanup()
      reject(new Error('Не удалось прочитать видео'))
    }
    const onAbort = (): void => {
      cleanup()
      reject(new DOMException('Конвертация отменена', 'AbortError'))
    }
    video.addEventListener(event, onEvent, { once: true })
    video.addEventListener('error', onError, { once: true })
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function seek(video: HTMLVideoElement, time: number, signal?: AbortSignal): Promise<void> {
  if (Math.abs(video.currentTime - time) < 0.001) return
  const ready = waitForVideoEvent(video, 'seeked', signal)
  video.currentTime = time
  await ready
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Конвертация отменена', 'AbortError')
}

/**
 * Превращает видео в зацикленный GIF.
 *
 * Берём первые maxSeconds секунд (по умолчанию 15), максимум 900 px по
 * длинной стороне и 12 кадров/с: это компромисс между качеством карты и
 * размером файла. Аудио не переносится.
 */
export async function convertVideoToGif(
  file: File,
  options: VideoToGifOptions = {}
): Promise<VideoToGifResult> {
  const maxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH
  const maxHeight = options.maxHeight ?? DEFAULT_MAX_HEIGHT
  const maxSeconds = options.maxSeconds ?? DEFAULT_MAX_SECONDS
  const fps = options.fps ?? DEFAULT_FPS
  const onProgress = options.onProgress
  const signal = options.signal

  onProgress?.(0)
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = url

  try {
    await waitForVideoEvent(video, 'loadedmetadata', signal)
    if (video.readyState < 2) await waitForVideoEvent(video, 'loadeddata', signal)
    const sourceDuration = videoDuration(video)
    const sourceWidth = video.videoWidth
    const sourceHeight = video.videoHeight
    if (!sourceWidth || !sourceHeight) throw new Error('Видео без изображения')

    const duration = sourceDuration > 0 ? Math.min(sourceDuration, maxSeconds) : maxSeconds
    const scale = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight)
    const width = Math.max(2, Math.round((sourceWidth * scale) / 2) * 2)
    const height = Math.max(2, Math.round((sourceHeight * scale) / 2) * 2)
    const frameCount = Math.max(1, Math.round(duration * fps))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Canvas недоступен')
    const gif = GIFEncoder()

    for (let index = 0; index < frameCount; index += 1) {
      throwIfAborted(signal)
      const time = Math.min(Math.max(0, duration - 0.001), index / fps)
      await seek(video, time, signal)
      context.drawImage(video, 0, 0, width, height)
      const frame = context.getImageData(0, 0, width, height)
      const palette = quantize(frame.data, 256, { format: 'rgb444' })
      const indexed = applyPalette(frame.data, palette, 'rgb444')
      gif.writeFrame(indexed, width, height, {
        palette,
        delay: Math.round(1000 / fps),
        ...(index === 0 ? { repeat: 0 } : {})
      })
      onProgress?.(0.08 + 0.86 * ((index + 1) / frameCount))
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    }

    gif.finish()
    const bytes = gif.bytes()
    if (bytes.byteLength > MAX_GIF_BYTES) {
      throw new Error('GIF получился больше 45 МБ — уменьшите длительность или разрешение видео')
    }
    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)
    onProgress?.(1)
    return {
      blob: new Blob([copy.buffer as ArrayBuffer], { type: 'image/gif' }),
      width,
      height,
      sourceDuration,
      duration,
      frames: frameCount,
      trimmed: sourceDuration > maxSeconds
    }
  } finally {
    video.pause()
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}
