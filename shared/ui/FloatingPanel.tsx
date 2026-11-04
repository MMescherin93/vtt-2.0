import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { XIcon } from './icons'

interface Position {
  x: number
  y: number
}

export interface FloatingPanelProps {
  title: string
  children: ReactNode
  /** Начальная позиция (левый верхний угол) */
  defaultPosition?: Position
  /** Ключ localStorage для запоминания позиции панели */
  storageKey?: string
  width?: number
  /** Начальная высота (нужна для resizable-панелей) */
  defaultHeight?: number
  /** Можно менять размер панели перетаскиванием краёв */
  resizable?: boolean
  minWidth?: number
  minHeight?: number
  onClose?: () => void
  /** Дополнительные действия в заголовке */
  actions?: ReactNode
  icon?: ReactNode
  className?: string
  /** Не перетаскивать панель (например, для мобильной раскладки) */
  fixed?: boolean
}

interface PanelSize {
  width: number
  height: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function loadSize(
  storageKey: string | undefined,
  fallbackWidth: number,
  fallbackHeight: number
): PanelSize {
  if (!storageKey) return { width: fallbackWidth, height: fallbackHeight }
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return { width: fallbackWidth, height: fallbackHeight }
    const parsed = JSON.parse(raw) as Partial<PanelSize>
    return {
      width: typeof parsed.width === 'number' && parsed.width > 0 ? parsed.width : fallbackWidth,
      height:
        typeof parsed.height === 'number' && parsed.height > 0 ? parsed.height : fallbackHeight
    }
  } catch {
    return { width: fallbackWidth, height: fallbackHeight }
  }
}

function loadPosition(storageKey: string | undefined, fallback: Position): Position {
  if (!storageKey) return fallback
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<Position>
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return { x: parsed.x, y: parsed.y }
    }
  } catch {
    // игнорируем повреждённое значение
  }
  return fallback
}

/**
 * Плавающая перетаскиваемая панель (ТЗ, UI/UX: панели не закреплены,
 * их можно перетаскивать, они полупрозрачны и не перекрывают карту целиком).
 */
export function FloatingPanel({
  title,
  children,
  defaultPosition = { x: 24, y: 24 },
  storageKey,
  width = 320,
  defaultHeight = 600,
  resizable = false,
  minWidth = 320,
  minHeight = 240,
  onClose,
  actions,
  icon,
  className = '',
  fixed = false
}: FloatingPanelProps) {
  const [position, setPosition] = useState<Position>(() =>
    loadPosition(storageKey, defaultPosition)
  )
  const [size, setSize] = useState<PanelSize>(() =>
    loadSize(storageKey, width, resizable ? defaultHeight : 0)
  )
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null)
  const resizeRef = useRef<{
    direction: 'x' | 'y' | 'both'
    startX: number
    startY: number
    width: number
    height: number
  } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!storageKey) return
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(
          resizable ? { ...position, width: size.width, height: size.height } : position
        )
      )
    } catch {
      // localStorage может быть недоступен — не критично
    }
  }, [position, size, storageKey, resizable])

  // При изменении размера окна не даём панели уехать за пределы экрана
  useEffect(() => {
    const onResize = (): void => {
      setPosition((current) => {
        const maxX = Math.max(8, window.innerWidth - 120)
        const maxY = Math.max(8, window.innerHeight - 80)
        return { x: Math.min(current.x, maxX), y: Math.min(current.y, maxY) }
      })
      if (!resizable) return
      setSize((current) => ({
        width: Math.min(current.width, Math.max(minWidth, window.innerWidth - 8)),
        height: Math.min(current.height, Math.max(minHeight, window.innerHeight - 8))
      }))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [resizable, minWidth, minHeight])

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (fixed) return
      if (event.button !== 0) return
      const target = event.target as HTMLElement
      if (target.closest('button, input, select, textarea, a')) return
      dragRef.current = {
        offsetX: event.clientX - position.x,
        offsetY: event.clientY - position.y
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [fixed, position.x, position.y]
  )

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const width = panelRef.current?.offsetWidth ?? 300
    const height = panelRef.current?.offsetHeight ?? 200
    setPosition({
      x: Math.min(Math.max(0, event.clientX - drag.offsetX), window.innerWidth - width),
      y: Math.min(Math.max(0, event.clientY - drag.offsetY), window.innerHeight - height)
    })
  }, [])

  const handlePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const startResize = useCallback(
    (direction: 'x' | 'y' | 'both') => (event: PointerEvent<HTMLDivElement>) => {
      if (!resizable) return
      event.preventDefault()
      event.stopPropagation()
      const rect = panelRef.current?.getBoundingClientRect()
      resizeRef.current = {
        direction,
        startX: event.clientX,
        startY: event.clientY,
        width: rect?.width ?? size.width,
        height: rect?.height ?? size.height
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [resizable, size.height, size.width]
  )

  const handleResizeMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const resize = resizeRef.current
      if (!resize) return
      const maxWidth = Math.max(minWidth, window.innerWidth - 8)
      const maxHeight = Math.max(minHeight, window.innerHeight - 8)
      const width =
        resize.direction === 'y'
          ? resize.width
          : clamp(resize.width + event.clientX - resize.startX, minWidth, maxWidth)
      const height =
        resize.direction === 'x'
          ? resize.height
          : clamp(resize.height + event.clientY - resize.startY, minHeight, maxHeight)
      setSize({ width, height })
    },
    [minHeight, minWidth]
  )

  const handleResizeEnd = useCallback((event: PointerEvent<HTMLDivElement>) => {
    resizeRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  return (
    <div
      ref={panelRef}
      className={`pointer-events-auto fixed z-30 flex max-h-[80vh] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#14161f]/85 shadow-2xl shadow-black/50 backdrop-blur-xl ${className}`}
      style={{
        left: fixed ? undefined : position.x,
        top: fixed ? undefined : position.y,
        width: resizable ? size.width : width,
        height: resizable ? size.height : undefined,
        maxHeight: resizable ? 'calc(100vh - 16px)' : undefined
      }}
    >
      {resizable && !fixed && (
        <>
          <div
            className="absolute right-0 top-9 bottom-4 z-20 w-1.5 cursor-ew-resize"
            onPointerDown={startResize('x')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            aria-label="Изменить ширину окна"
          />
          <div
            className="absolute bottom-0 left-2 right-4 z-20 h-1.5 cursor-ns-resize"
            onPointerDown={startResize('y')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            aria-label="Изменить высоту окна"
          />
          <div
            className="group absolute bottom-0 right-0 z-20 h-4 w-4 cursor-nwse-resize"
            onPointerDown={startResize('both')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            aria-label="Изменить размер окна"
            title="Потяните, чтобы изменить размер окна"
          >
            <span className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-sm border-b border-r border-white/35 transition group-hover:border-indigo-300" />
          </div>
        </>
      )}

      <div
        className={`flex select-none items-center gap-2 border-b border-white/10 px-3 py-2 ${
          fixed ? '' : 'cursor-grab active:cursor-grabbing'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {icon && <span className="text-indigo-300">{icon}</span>}
        <span className="truncate text-sm font-semibold text-gray-100">{title}</span>
        <div className="ml-auto flex items-center gap-1">
          {actions}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть панель"
              className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition hover:bg-white/10 hover:text-white"
            >
              <XIcon size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
