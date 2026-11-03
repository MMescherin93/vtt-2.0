import { useEffect, useState } from 'react'

export interface LoadedImage {
  image: HTMLImageElement | null
  loading: boolean
  error: boolean
}

/**
 * Загружает изображение для Konva (карта/токен).
 * Пустой url — изображение не запрашивается.
 */
export function useImage(url: string): LoadedImage {
  const [state, setState] = useState<LoadedImage>({
    image: null,
    loading: Boolean(url),
    error: false
  })

  useEffect(() => {
    if (!url) {
      setState({ image: null, loading: false, error: false })
      return
    }

    let alive = true
    const image = new window.Image()
    image.crossOrigin = 'anonymous'
    setState({ image: null, loading: true, error: false })

    image.onload = (): void => {
      if (alive) setState({ image, loading: false, error: false })
    }
    image.onerror = (): void => {
      if (alive) setState({ image: null, loading: false, error: true })
    }
    image.src = url

    return () => {
      alive = false
      image.onload = null
      image.onerror = null
    }
  }, [url])

  return state
}
