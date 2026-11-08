import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from 'react'
import { GripIcon, XIcon } from './icons'

interface Position {
  x: number
  y: number
}

interface PanelSize {
  width: number
  height: number
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

/** Отступ панели от краёв окна */
const VIEWPORT_MARGIN = 8
/**
 * Верхняя и нижняя полосы окна заняты тулбаром, доком модулей и кнопками
 * управления. Панель не должна начинаться под ними и не должна занимать
 * их целиком, иначе заголовок не схватить, а кнопки «под» панелью.
 */
const TOP_CHROME_INSET = 64
const BOTTOM_CHROME_INSET = 64

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getViewport(): PanelSize {
  if (typeof window === 'undefined') return { width: 1280, height: 800 }
  return { width: window.innerWidth, height: window.innerHeight }
}

/**
 * Держит панель в пределах окна. Если панель шире окна, разрешаем сдвигать
 * её влево-вправо, чтобы дотянуться до обоих краёв, но не «прибиваем» к
 * отрицательной координате (из-за этого панель раньше застревала).
 */
function clampPosition(
  position: Position,
  width: number,
  height: number,
  viewport: PanelSize
): Position {
  const maxX = Math.max(0, viewport.width - width - VIEWPORT_MARGIN)
  const minX = Math.min(0, viewport.width - width - VIEWPORT_MARGIN)
  const maxY = Math.max(0, viewport.height - height - VIEWPORT_MARGIN)
  const minY = Math.min(TOP_CHROME_INSET, maxY)
  return {
    x: clamp(position.x, minX, maxX),
    y: clamp(position.y, minY, maxY)
  }
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
 *
 * Панель всегда остаётся в пределах окна: размер ужимается под вьюпорт,
 * заголовок не уезжает за экран, а перетаскивание работает даже над iframe
 * (на время жеста iframe перестают перехватывать указатель).
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
  const [viewport, setViewport] = useState<PanelSize>(getViewport)
  const [interacting, setInteracting] = useState(false)
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null)
  const resizeRef = useRef<{
    pointerId: number
    direction: 'x' | 'y' | 'both'
    startX: number
    startY: number
    width: number
    height: number
  } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  // Актуальные ограничения для обработчиков window: они навешиваются один раз.
  const limitsRef = useRef({ width, defaultHeight, minWidth, minHeight })
  limitsRef.current = { width, defaultHeight, minWidth, minHeight }

  const maximumWidth = Math.max(minWidth, viewport.width - VIEWPORT_MARGIN * 2)
  const maximumHeight = Math.max(
    minHeight,
    viewport.height - TOP_CHROME_INSET - BOTTOM_CHROME_INSET
  )
  const panelWidth = resizable ? Math.min(size.width, maximumWidth) : width

  useEffect(() => {
    if (!storageKey) return
    // Запись откладываем: при перетаскивании позиция меняется на каждый кадр.
    const timer = window.setTimeout(() => {
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
    }, 150)
    return () => window.clearTimeout(timer)
  }, [position, size, storageKey, resizable])

  useEffect(() => {
    const onResize = (): void => setViewport(getViewport())
    window.addEventListener('resize', onResize)
    const visualViewport = window.visualViewport
    visualViewport?.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      visualViewport?.removeEventListener('resize', onResize)
    }
  }, [])

  // Ужимаем панель под окно и не даём ей уехать за край (в т.ч. после
  // сохранённой позиции с большего монитора).
  useLayoutEffect(() => {
    if (fixed) return
    if (resizable) {
      setSize((current) => {
        const nextWidth = Math.min(current.width, maximumWidth)
        const nextHeight = Math.min(current.height, maximumHeight)
        return nextWidth === current.width && nextHeight === current.height
          ? current
          : { width: nextWidth, height: nextHeight }
      })
    }
    const element = panelRef.current
    const currentWidth = resizable
      ? Math.min(size.width, maximumWidth)
      : (element?.offsetWidth ?? width)
    const currentHeight = resizable
      ? Math.min(size.height, maximumHeight)
      : (element?.offsetHeight ?? defaultHeight)
    setPosition((current) => {
      const next = clampPosition(current, currentWidth, currentHeight, viewport)
      return next.x === current.x && next.y === current.y ? current : next
    })
  }, [
    fixed,
    resizable,
    viewport,
    maximumWidth,
    maximumHeight,
    size.width,
    size.height,
    width,
    defaultHeight
  ])

  /** На время жеста iframe внутри панели не должны перехватывать указатель. */
  const setFramesInteractive = useCallback((interactive: boolean) => {
    document.querySelectorAll('iframe').forEach((frame) => {
      frame.style.pointerEvents = interactive ? '' : 'none'
    })
  }, [])

  const finishInteraction = useCallback(() => {
    if (!dragRef.current && !resizeRef.current) return
    dragRef.current = null
    resizeRef.current = null
    setInteracting(false)
    setFramesInteractive(true)
    document.body.style.removeProperty('cursor')
    document.body.style.removeProperty('user-select')
  }, [setFramesInteractive])

  // Слушаем window, а не только заголовок: так перетаскивание не обрывается,
  // когда указатель уходит за пределы панели или на её iframe.
  useEffect(() => {
    const onPointerMove = (event: PointerEvent): void => {
      const drag = dragRef.current
      if (drag) {
        if (event.pointerId !== drag.pointerId) return
        // Кнопку могли отпустить за пределами окна — жест считаем завершённым.
        if (event.pointerType === 'mouse' && event.buttons === 0) {
          finishInteraction()
          return
        }
        event.preventDefault()
        const panel = panelRef.current
        if (!panel) return
        setPosition(
          clampPosition(
            { x: event.clientX - drag.offsetX, y: event.clientY - drag.offsetY },
            panel.offsetWidth,
            panel.offsetHeight,
            getViewport()
          )
        )
        return
      }

      const resize = resizeRef.current
      if (!resize || event.pointerId !== resize.pointerId) return
      if (event.pointerType === 'mouse' && event.buttons === 0) {
        finishInteraction()
        return
      }
      event.preventDefault()
      const currentViewport = getViewport()
      const limits = limitsRef.current
      const maxWidth = Math.max(limits.minWidth, currentViewport.width - VIEWPORT_MARGIN * 2)
      const maxHeight = Math.max(
        limits.minHeight,
        currentViewport.height - TOP_CHROME_INSET - BOTTOM_CHROME_INSET
      )
      const nextWidth =
        resize.direction === 'y'
          ? resize.width
          : clamp(resize.width + event.clientX - resize.startX, limits.minWidth, maxWidth)
      const nextHeight =
        resize.direction === 'x'
          ? resize.height
          : clamp(resize.height + event.clientY - resize.startY, limits.minHeight, maxHeight)
      setSize({ width: nextWidth, height: nextHeight })
      setPosition((current) => clampPosition(current, nextWidth, nextHeight, currentViewport))
    }

    const onPointerUp = (event: PointerEvent): void => {
      const active = dragRef.current ?? resizeRef.current
      if (!active || active.pointerId !== event.pointerId) return
      finishInteraction()
    }

    const onWindowBlur = (): void => finishInteraction()

    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    window.addEventListener('blur', onWindowBlur)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      window.removeEventListener('blur', onWindowBlur)
      setFramesInteractive(true)
    }
  }, [finishInteraction, setFramesInteractive])

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (fixed) return
      if (event.button !== 0) return
      const target = event.target as HTMLElement
      if (target.closest('button, input, select, textarea, a, [role="button"]')) return
      event.preventDefault()
      dragRef.current = {
        pointerId: event.pointerId,
        offsetX: event.clientX - position.x,
        offsetY: event.clientY - position.y
      }
      setInteracting(true)
      setFramesInteractive(false)
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Захват не критичен: движение обрабатывают window-обработчики
      }
    },
    [fixed, position.x, position.y, setFramesInteractive]
  )

  const startResize = useCallback(
    (direction: 'x' | 'y' | 'both') => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!resizable || event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      const rect = panelRef.current?.getBoundingClientRect()
      resizeRef.current = {
        pointerId: event.pointerId,
        direction,
        startX: event.clientX,
        startY: event.clientY,
        width: rect?.width ?? size.width,
        height: rect?.height ?? size.height
      }
      setInteracting(true)
      setFramesInteractive(false)
      document.body.style.cursor =
        direction === 'x' ? 'ew-resize' : direction === 'y' ? 'ns-resize' : 'nwse-resize'
      document.body.style.userSelect = 'none'
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Захват не критичен: движение обрабатывают window-обработчики
      }
    },
    [resizable, size.width, size.height, setFramesInteractive]
  )

  return (
    <div
      ref={panelRef}
      className={`pointer-events-auto fixed z-30 flex max-h-[80vh] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#14161f]/85 shadow-2xl shadow-black/50 backdrop-blur-xl ${
        interacting ? 'select-none' : ''
      } ${className}`}
      style={{
        left: fixed ? undefined : position.x,
        top: fixed ? undefined : position.y,
        width: panelWidth,
        height: resizable ? Math.min(size.height, maximumHeight) : undefined,
        maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
        maxHeight: resizable && !fixed ? maximumHeight : undefined
      }}
    >
      {resizable && !fixed && (
        <>
          <div
            className="absolute right-0 top-9 bottom-4 z-20 w-1.5 cursor-ew-resize touch-none"
            onPointerDown={startResize('x')}
            aria-label="Изменить ширину окна"
          />
          <div
            className="absolute bottom-0 left-2 right-4 z-20 h-1.5 cursor-ns-resize touch-none"
            onPointerDown={startResize('y')}
            aria-label="Изменить высоту окна"
          />
          <div
            className="group absolute bottom-0 right-0 z-20 h-4 w-4 cursor-nwse-resize touch-none"
            onPointerDown={startResize('both')}
            aria-label="Изменить размер окна"
            title="Потяните, чтобы изменить размер окна"
          >
            <span className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-sm border-b border-r border-white/35 transition group-hover:border-indigo-300" />
          </div>
        </>
      )}

      <div
        className={`flex touch-none select-none items-center gap-2 border-b border-white/10 px-3 py-2 ${
          fixed ? '' : 'cursor-grab'
        }`}
        onPointerDown={handlePointerDown}
        onDragStart={(event) => event.preventDefault()}
      >
        {!fixed && (
          <span
            className="flex h-5 w-3 shrink-0 items-center justify-center text-gray-500"
            title="Перетащите, чтобы переместить окно"
            aria-hidden="true"
          >
            <GripIcon size={12} />
          </span>
        )}
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
