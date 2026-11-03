import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type ReactNode
} from 'react'
import { Layer, Line, Rect, Stage } from 'react-konva'
import type { FogOfWarData } from '../types/map'
import {
  clampCamera,
  fitCamera,
  screenToWorld,
  zoomAt,
  type Camera,
  type Point,
  type Size
} from '../utils/camera'
import { appendFogOp } from '../utils/fog'
import { layoutMaps } from '../utils/maps'
import { FitIcon, ZoomInIcon, ZoomOutIcon } from './icons'
import { useElementSize } from './useElementSize'
import { DrawingsLayer } from './board/DrawingsLayer'
import { FogLayer } from './board/FogLayer'
import { GridLayer, type VisibleRect } from './board/GridLayer'
import { MapLayer } from './board/MapLayer'
import { TokensLayer } from './board/TokensLayer'
import { loadCamera, saveCamera } from './board/cameraStorage'
import type { BoardProps } from './board/types'

/** Размер виртуального стола, пока карта не загружена */
const EMPTY_FIELD: Size = { width: 1920, height: 1080 }

type Draft =
  | { kind: 'draw'; mode: 'pencil' | 'eraser'; points: number[] }
  | { kind: 'fog-stroke'; points: number[]; op: 'reveal' | 'conceal' }
  | { kind: 'fog-rect'; start: Point; current: Point }

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

function ZoomButton({
  label,
  onClick,
  children
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#14161f]/85 text-gray-300 backdrop-blur transition hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  )
}

/**
 * Общий Konva-канвас Мастера и игроков (ТЗ, этапы 3–5):
 * карта, сетка, токены, туман войны и рисование. У каждого клиента своя
 * независимая камера, которая сохраняется локально (уточнение 2).
 */
export function Board({
  session,
  role,
  tool,
  drawStyle,
  fogTool,
  fogBrushSize,
  showFogPreview,
  assetsBaseUrl,
  cameraKey,
  selectedTokenId,
  onSelectToken,
  onMoveToken,
  onTransformToken,
  onAddDrawing,
  onFogChange,
  onFilesDropped,
  showTokenLabels = true,
  disabled = false
}: BoardProps) {
  const layout = useMemo(() => layoutMaps(session.maps), [session.maps])
  const hasMap = session.maps.length > 0
  const field = useMemo<Size>(() => {
    if (layout.world.width > 0 && layout.world.height > 0) {
      return { width: layout.world.width, height: layout.world.height }
    }
    return EMPTY_FIELD
  }, [layout])

  const { ref: containerRef, size: viewport } = useElementSize<HTMLDivElement>()
  const storageKey = `${cameraKey}:${field.width}x${field.height}`

  const [camera, setCamera] = useState<Camera>(
    () => loadCamera(storageKey) ?? { x: 0, y: 0, scale: 1 }
  )
  const [spaceDown, setSpaceDown] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fittedRef = useRef('')

  const isGm = role === 'gm'
  const canEditFog = isGm && !disabled

  // Восстановление/вписывание камеры и удержание её в пределах карты
  useEffect(() => {
    if (viewport.width < 20 || viewport.height < 20) return
    setCamera((current) => {
      if (fittedRef.current !== storageKey) {
        fittedRef.current = storageKey
        const saved = loadCamera(storageKey)
        return saved ? clampCamera(saved, viewport, field) : fitCamera(viewport, field)
      }
      return clampCamera(current, viewport, field)
    })
  }, [viewport, field, storageKey])

  useEffect(() => {
    saveCamera(storageKey, camera)
  }, [camera, storageKey])

  // Пробел — временное панорамирование
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === 'Space' && !isTypingTarget(event.target)) {
        event.preventDefault()
        setSpaceDown(true)
      }
    }
    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code === 'Space') setSpaceDown(false)
    }
    const onBlur = (): void => setSpaceDown(false)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  const panEnabled = !disabled && (tool === 'pan' || tool === 'select' || spaceDown)

  const pointerWorld = useCallback(
    (stage: Konva.Stage | null): Point | null => {
      const pointer = stage?.getPointerPosition()
      if (!pointer) return null
      return screenToWorld(camera, pointer)
    },
    [camera]
  )

  const handleWheel = useCallback(
    (event: KonvaEventObject<WheelEvent>) => {
      event.evt.preventDefault()
      if (disabled) return
      const pointer = event.target.getStage()?.getPointerPosition()
      if (!pointer) return
      const factor = Math.exp(-event.evt.deltaY * 0.0015)
      setCamera((current) => clampCamera(zoomAt(current, factor, pointer), viewport, field))
    },
    [disabled, viewport, field]
  )

  const handleStageDragMove = useCallback((event: KonvaEventObject<DragEvent>) => {
    const stage = event.target.getStage()
    if (!stage) return
    setCamera((current) => ({ ...current, x: stage.x(), y: stage.y() }))
  }, [])

  const handleStageDragEnd = useCallback(
    (event: KonvaEventObject<DragEvent>) => {
      const stage = event.target.getStage()
      if (!stage) return
      setCamera((current) =>
        clampCamera({ ...current, x: stage.x(), y: stage.y() }, viewport, field)
      )
    },
    [viewport, field]
  )

  const handleMouseDown = useCallback(
    (event: KonvaEventObject<MouseEvent>) => {
      const stage = event.target.getStage()
      if (!stage) return

      if (tool === 'select' || tool === 'pan') {
        if (event.target === stage) onSelectToken(null)
        return
      }
      if (disabled) return

      const point = pointerWorld(stage)
      if (!point) return

      if (tool === 'draw' || tool === 'erase') {
        setDraft({
          kind: 'draw',
          mode: tool === 'erase' ? 'eraser' : 'pencil',
          points: [point.x, point.y]
        })
        return
      }

      if (tool === 'fog' && canEditFog) {
        if (fogTool === 'rect') {
          setDraft({ kind: 'fog-rect', start: point, current: point })
        } else {
          setDraft({
            kind: 'fog-stroke',
            points: [point.x, point.y],
            op: fogTool === 'brush' ? 'conceal' : 'reveal'
          })
        }
      }
    },
    [tool, disabled, pointerWorld, canEditFog, fogTool, onSelectToken]
  )

  const handleMouseMove = useCallback(
    (event: KonvaEventObject<MouseEvent>) => {
      if (!draft) return
      const stage = event.target.getStage()
      const point = pointerWorld(stage)
      if (!point) return

      if (draft.kind === 'fog-rect') {
        setDraft({ ...draft, current: point })
        return
      }

      const points = draft.points
      const length = points.length
      const dx = point.x - points[length - 2]!
      const dy = point.y - points[length - 1]!
      if (dx * dx + dy * dy < 9) return
      setDraft({ ...draft, points: [...points, point.x, point.y] })
    },
    [draft, pointerWorld]
  )

  const commitDraft = useCallback(() => {
    if (!draft) return
    setDraft(null)

    if (draft.kind === 'draw') {
      if (draft.points.length < 4) return
      onAddDrawing({
        tool: draft.mode,
        color: draft.mode === 'eraser' ? '#000000' : drawStyle.color,
        size: draft.mode === 'eraser' ? Math.max(20, drawStyle.size * 3) : drawStyle.size,
        points: draft.points
      })
      return
    }

    if (draft.kind === 'fog-stroke') {
      if (draft.points.length < 2) return
      const next: FogOfWarData = appendFogOp(session.fogOfWar, {
        op: draft.op,
        shape: 'stroke',
        points: draft.points,
        size: fogBrushSize
      })
      onFogChange(next)
      return
    }

    const x = Math.min(draft.start.x, draft.current.x)
    const y = Math.min(draft.start.y, draft.current.y)
    const width = Math.abs(draft.current.x - draft.start.x)
    const height = Math.abs(draft.current.y - draft.start.y)
    if (width < 6 || height < 6) return
    onFogChange(
      appendFogOp(session.fogOfWar, {
        op: 'reveal',
        shape: 'rect',
        x,
        y,
        width,
        height
      })
    )
  }, [draft, drawStyle, fogBrushSize, onAddDrawing, onFogChange, session.fogOfWar])

  const handleMouseUp = useCallback(() => {
    commitDraft()
  }, [commitDraft])

  const view = useMemo<VisibleRect>(() => {
    const scale = camera.scale
    return {
      x0: Math.max(0, -camera.x / scale),
      y0: Math.max(0, -camera.y / scale),
      x1: Math.min(field.width, (viewport.width - camera.x) / scale),
      y1: Math.min(field.height, (viewport.height - camera.y) / scale)
    }
  }, [camera, viewport.width, viewport.height, field])

  const zoomBy = useCallback(
    (factor: number) => {
      const center = { x: viewport.width / 2, y: viewport.height / 2 }
      setCamera((current) => clampCamera(zoomAt(current, factor, center), viewport, field))
    },
    [viewport, field]
  )

  const fit = useCallback(() => {
    setCamera(fitCamera(viewport, field))
  }, [viewport, field])

  const isDrawingTool = tool === 'draw' || tool === 'erase' || (tool === 'fog' && canEditFog)
  const cursorClass = isDrawingTool
    ? 'cursor-crosshair'
    : panEnabled
      ? dragOver
        ? 'cursor-copy'
        : 'cursor-grab'
      : 'cursor-default'

  const handleDrop = (event: ReactDragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setDragOver(false)
    if (!onFilesDropped) return
    const files = Array.from(event.dataTransfer.files)
    if (files.length === 0) return
    const rect = containerRef.current?.getBoundingClientRect()
    const world = rect
      ? screenToWorld(camera, {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        })
      : { x: field.width / 2, y: field.height / 2 }
    onFilesDropped(files, world)
  }

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden bg-[#0b0d12] ${cursorClass}`}
      onDragOver={(event) => {
        if (!onFilesDropped) return
        event.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {viewport.width > 0 && viewport.height > 0 && (
        <Stage
          width={viewport.width}
          height={viewport.height}
          x={camera.x}
          y={camera.y}
          scaleX={camera.scale}
          scaleY={camera.scale}
          draggable={panEnabled}
          onWheel={handleWheel}
          onDragMove={handleStageDragMove}
          onDragEnd={handleStageDragEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <MapLayer
            sessionId={session.id}
            assetsBaseUrl={assetsBaseUrl}
            placements={layout.items}
            width={field.width}
            height={field.height}
            hasMaps={hasMap}
            canUpload={isGm}
          />

          <GridLayer
            gridType={session.settings.gridType}
            gridSize={session.settings.gridSize}
            showGrid={session.settings.showGrid}
            width={field.width}
            height={field.height}
            cameraScale={camera.scale}
            view={view}
          />

          <TokensLayer
            session={session}
            assetsBaseUrl={assetsBaseUrl}
            role={role}
            width={field.width}
            height={field.height}
            interactive={tool === 'select' && !disabled}
            selectedTokenId={selectedTokenId}
            showLabels={showTokenLabels}
            onSelect={onSelectToken}
            onMove={onMoveToken}
            onTransform={onTransformToken}
          />

          <FogLayer
            fog={session.fogOfWar}
            width={field.width}
            height={field.height}
            opacity={isGm ? 0.35 : 1}
            visible={isGm ? showFogPreview : true}
          />

          <DrawingsLayer drawings={session.drawings} width={field.width} height={field.height} />

          <Layer listening={false}>
            {draft?.kind === 'draw' && (
              <Line
                points={draft.points}
                stroke={draft.mode === 'eraser' ? 'rgba(248,250,252,0.35)' : drawStyle.color}
                strokeWidth={
                  draft.mode === 'eraser' ? Math.max(20, drawStyle.size * 3) : drawStyle.size
                }
                lineCap="round"
                lineJoin="round"
                dash={draft.mode === 'eraser' ? [12, 10] : undefined}
                opacity={0.9}
                listening={false}
              />
            )}
            {draft?.kind === 'fog-stroke' && (
              <Line
                points={draft.points}
                stroke="rgba(148,163,184,0.65)"
                strokeWidth={fogBrushSize}
                lineCap="round"
                lineJoin="round"
                dash={[14, 10]}
                listening={false}
              />
            )}
            {draft?.kind === 'fog-rect' && (
              <Rect
                x={Math.min(draft.start.x, draft.current.x)}
                y={Math.min(draft.start.y, draft.current.y)}
                width={Math.abs(draft.current.x - draft.start.x)}
                height={Math.abs(draft.current.y - draft.start.y)}
                stroke="rgba(148,163,184,0.9)"
                strokeWidth={2 / camera.scale}
                dash={[10 / camera.scale, 8 / camera.scale]}
                fill="rgba(148,163,184,0.12)"
                listening={false}
              />
            )}
          </Layer>
        </Stage>
      )}

      <div className="pointer-events-auto absolute bottom-4 right-4 flex flex-col items-center gap-1">
        <ZoomButton label="Приблизить" onClick={() => zoomBy(1.2)}>
          <ZoomInIcon size={16} />
        </ZoomButton>
        <span className="rounded-md border border-white/10 bg-[#14161f]/85 px-1.5 py-0.5 text-[11px] font-medium text-gray-400 backdrop-blur">
          {Math.round(camera.scale * 100)}%
        </span>
        <ZoomButton label="Отдалить" onClick={() => zoomBy(1 / 1.2)}>
          <ZoomOutIcon size={16} />
        </ZoomButton>
        <ZoomButton label="Вписать карту" onClick={fit}>
          <FitIcon size={16} />
        </ZoomButton>
      </div>

      {dragOver && (
        <div className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-xl border-2 border-dashed border-indigo-400/60 bg-indigo-500/10">
          <span className="rounded-lg bg-[#14161f]/90 px-3 py-2 text-sm text-indigo-200">
            Отпустите файл, чтобы загрузить
          </span>
        </div>
      )}
    </div>
  )
}
