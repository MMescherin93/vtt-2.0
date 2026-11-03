import { useEffect, useRef, useState } from 'react'
import type { Size } from '../utils/camera'

/** Размер DOM-элемента через ResizeObserver (для Konva Stage) */
export function useElementSize<T extends HTMLElement>(): {
  ref: React.RefObject<T>
  size: Size
} {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const update = (): void => {
      const rect = element.getBoundingClientRect()
      setSize({
        width: Math.max(0, Math.round(rect.width)),
        height: Math.max(0, Math.round(rect.height))
      })
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return { ref, size }
}
