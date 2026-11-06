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
import type { FogOfWarData, MapText } from '../types/map'
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
import { layoutMaps, MAP_GAP } from '../utils/maps'
import { FitIcon, ZoomInIcon, ZoomOutIcon } from './icons'
import { useElementSize } from './useElementSize'
import { DrawingsLayer } from './board/DrawingsLayer'
import { FogLayer } from './board/FogLayer'
import { GM_DIM_FOG_OPACITY } from './board/fogRender'
import { GridLayer, type VisibleRect } from './board/GridLayer'
import { MapLayer } from './board/MapLayer'
import { TextLayer } from './board/TextLayer'
import { TokensLayer } from './board/TokensLayer'
import { TokenStatsLayer } from './board/TokenStatsLayer'
import { loadCamera, saveCamera } from './board/cameraStorage'
import type { BoardProps } from './board/types'

/** Размер виртуального стола, пока карта не загружена */
const EMPTY_FIELD: Size = { width: 1920, height: 1080 }

type TextDraft = {
  id: string | null
  x: number
  y: number
  text: string
  color: string
  fontSize: number
}

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
  textSize,
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
  onAddText,
  onUpdateText,
  onRemoveText,
  onFogChange,
  onFilesDropped,
  showTokenLabels = true,
  focusMap = null,
  onActiveMapChange,
  disabled = false
}: BoardProps) {
  const layout = useMemo(
    () => layoutMaps(session.maps, MAP_GAP, session.settings.mapLayout),
    [session.maps, session.settings.mapLayout]
  )
  const hasMap = session.maps.length > 0
  const statsVisible = session.enabledExtensions['token-stats'] ?? false
  const initiativeEnabled = session.enabledExtensions['initiative'] ?? false
  const activeCombatant =
    initiativeEnabled && session.combat?.active
      ? session.combat.combatants.find((combatant) => combatant.id === session.combat?.turnId)
      : undefined
  const activeTokenId = activeCombatant?.tokenId ?? null
  const field = useMemo<Size>(() => {
    if (layout.world.width > 0 && layout.world.height > 0) {
      return { width: layout.world.width, height: layout.world.height }
    }
    return EMPTY_FIELD
  }, [layout])

  const { ref: containerRef, size: viewport } = useElementSize<HTMLDivElement>()
  // Ключ не зависит от размеров мира: добавление/удаление карт не должно
  // сбрасывать камеру и возвращать её к «центрированию» полотна.
  const storageKey = cameraKey

  const [camera, setCamera] = useState<Camera>(
    () =>
      loadCamera(storageKey) ??
      loadCamera(`${cameraKey}:${field.width}x${field.height}`) ??
      { x: 0, y: 0, scale: 1 }
  )
  const [spaceDown, setSpaceDown] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null)
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const textCommitRef = useRef(false)
  const [dragOver, setDragOver] = useState(false)

  const isGm = role === 'gm'
  const canEditFog = isGm && !disabled

  useEffect(() => {
    saveCamera(storageKey, camera)
  }, [camera, storageKey])

  // Перелёт камеры к выбранной в мини-индикаторе карте (один раз на клик)
  const focusSeqRef = useRef(0)
  useEffect(() => {
    if (!focusMap || viewport.width < 20 || viewport.height < 20) return
    if (focusMap.seq === focusSeqRef.current) return
    focusSeqRef.current = focusMap.seq

    const placement = layout.items.find((item) => item.map.id === focusMap.mapId)
    if (!placement) return

    const fitted = fitCamera(
      viewport,
      { width: placement.boundsWidth, height: placement.boundsHeight },
      60
    )
    // Центрируем именно карту, а не всё полотно.
    const centerX = placement.x + placement.width / 2
    const centerY = placement.y + placement.height / 2
    setCamera({
      x: viewport.width / 2 - centerX * fitted.scale,
      y: viewport.height / 2 - centerY * fitted.scale,
      scale: fitted.scale
    })
  }, [focusMap, layout, viewport, field])

  // Сообщаем приложению, какая карта в центре экрана
  const activeMapRef = useRef<string | null>(null)
  useEffect(() => {
    if (!onActiveMapChange) return
    if (viewport.width < 20) return
    const centerX = (viewport.width / 2 - camera.x) / camera.scale
    const centerY = (viewport.height / 2 - camera.y) / camera.scale
    const placement = layout.items.find((item) => {
      const left = item.x - (item.boundsWidth - item.width) / 2
      const top = item.y - (item.boundsHeight - item.height) / 2
      return (
        centerX >= left &&
        centerX <= left + item.boundsWidth &&
        centerY >= top &&
        centerY <= top + item.boundsHeight
      )
    })
    const mapId = placement?.map.id ?? null
    if (activeMapRef.current !== mapId) {
      activeMapRef.current = mapId
      onActiveMapChange(mapId)
    }
  }, [camera, layout, viewport.width, onActiveMapChange])

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

  const commitText = useCallback(() => {
    const current = textDraft
    if (!current || textCommitRef.current) return
    textCommitRef.current = true
    setTextDraft(null)
    if (!current.text.trim()) return
    if (current.id) {
      onUpdateText({
        textId: current.id,
        text: current.text,
        color: current.color,
        fontSize: current.fontSize
      })
    } else {
      onAddText({
        x: current.x,
        y: current.y,
        text: current.text,
        color: current.color,
        fontSize: current.fontSize
      })
    }
  }, [textDraft, onAddText, onUpdateText])

  const openTextEditor = useCallback((item: MapText) => {
    textCommitRef.current = false
    setSelectedTextId(item.id)
    setTextDraft({
      id: item.id,
      x: item.x,
      y: item.y,
      text: item.text,
      color: item.color,
      fontSize: item.fontSize
    })
  }, [])

  const handleSelectText = useCallback(
    (textId: string | null) => {
      setSelectedTextId(textId)
      if (textId) onSelectToken(null)
    },
    [onSelectToken]
  )

  const textDraftKey = textDraft ? `${textDraft.id ?? 'new'}:${textDraft.x}:${textDraft.y}` : ''

  useEffect(() => {
    if (!textDraftKey) return
    const timer = window.setTimeout(() => {
      const element = textareaRef.current
      element?.focus()
      element?.setSelectionRange(element.value.length, element.value.length)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [textDraftKey])

  useEffect(() => {
    if (tool === 'select') return
    setSelectedTextId(null)
  }, [tool])

  useEffect(() => {
    if (!selectedTextId) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target)) return
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      event.preventDefault()
      onRemoveText(selectedTextId)
      setSelectedTextId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedTextId, onRemoveText])

  const handleMouseDown = useCallback(
    (event: KonvaEventObject<MouseEvent>) => {
      const stage = event.target.getStage()
      if (!stage) return

      if (tool === 'text') {
        if (disabled) return
        if (textDraft) {
          commitText()
          return
        }
        const point = pointerWorld(stage)
        if (!point) return
        setSelectedTextId(null)
        onSelectToken(null)
        textCommitRef.current = false
        setTextDraft({
          id: null,
          x: point.x,
          y: point.y,
          text: '',
          color: drawStyle.color,
          fontSize: textSize
        })
        return
      }

      if (tool === 'select' || tool === 'pan') {
        if (event.target === stage) {
          onSelectToken(null)
          setSelectedTextId(null)
        }
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
    [
      tool,
      disabled,
      pointerWorld,
      canEditFog,
      fogTool,
      onSelectToken,
      textDraft,
      commitText,
      drawStyle.color,
      textSize
    ]
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
    // «Вписать» относится к карте, на которой сейчас стоит камера, а не ко
    // всему полотну из нескольких карт. Иначе при двух и более картах камера
    // уезжает на общий мир и карта становится слишком мелкой.
    const centerX = (viewport.width / 2 - camera.x) / camera.scale
    const centerY = (viewport.height / 2 - camera.y) / camera.scale
    const active =
      layout.items.find((item) => {
        const left = item.x - (item.boundsWidth - item.width) / 2
        const top = item.y - (item.boundsHeight - item.height) / 2
        return (
          centerX >= left &&
          centerX <= left + item.boundsWidth &&
          centerY >= top &&
          centerY <= top + item.boundsHeight
        )
      }) ?? layout.items[0]

    if (!active) {
      setCamera(fitCamera(viewport, field))
      return
    }

    const fitted = fitCamera(
      viewport,
      { width: active.boundsWidth, height: active.boundsHeight },
      60
    )
    const mapCenterX = active.x + active.width / 2
    const mapCenterY = active.y + active.height / 2
    setCamera({
      x: viewport.width / 2 - mapCenterX * fitted.scale,
      y: viewport.height / 2 - mapCenterY * fitted.scale,
      scale: fitted.scale
    })
  }, [viewport, field, camera, layout])

  const isDrawingTool = tool === 'draw' || tool === 'erase' || (tool === 'fog' && canEditFog)
  const cursorClass =
    tool === 'text'
      ? 'cursor-text'
      : isDrawingTool
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
            color={session.settings.gridColor}
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
            labelColor={session.settings.tokenLabelColor}
            activeTokenId={activeTokenId}
            onSelect={(tokenId) => {
              setSelectedTextId(null)
              onSelectToken(tokenId)
            }}
            onMove={onMoveToken}
            onTransform={onTransformToken}
          />

          <TokenStatsLayer
            session={session}
            role={role}
            width={field.width}
            height={field.height}
            visible={statsVisible}
          />

          <TextLayer
            texts={session.texts}
            width={field.width}
            height={field.height}
            interactive={tool === 'select' && !disabled}
            selectedTextId={selectedTextId}
            onSelect={handleSelectText}
            onMove={(textId, x, y) => onUpdateText({ textId, x, y })}
            onEdit={openTextEditor}
          />

          <FogLayer
            fog={session.fogOfWar}
            width={field.width}
            height={field.height}
            opacity={isGm && !showFogPreview ? GM_DIM_FOG_OPACITY : 1}
            visible
            binary={isGm && showFogPreview}
            camera={camera}
            viewport={viewport}
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

      <div className="pointer-events-auto absolute bottom-14 right-4 flex flex-col items-center gap-1">
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

      {textDraft && (
        <div
          className="absolute z-30 rounded-lg border border-indigo-400/60 bg-[#0f1117]/95 p-1.5 shadow-2xl shadow-black/60"
          style={{
            left: camera.x + textDraft.x * camera.scale,
            top: camera.y + textDraft.y * camera.scale
          }}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <textarea
            ref={textareaRef}
            value={textDraft.text}
            rows={Math.max(2, textDraft.text.split('\n').length)}
            onChange={(event) =>
              setTextDraft((current) =>
                current ? { ...current, text: event.target.value } : current
              )
            }
            onBlur={commitText}
            onKeyDown={(event) => {
              event.stopPropagation()
              if (event.key === 'Escape') {
                event.preventDefault()
                setTextDraft(null)
                return
              }
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault()
                commitText()
              }
            }}
            placeholder="Текст заметки…"
            spellCheck={false}
            className="block w-72 resize-both rounded border border-white/10 bg-black/40 p-2 font-semibold leading-snug text-gray-100 outline-none placeholder:text-gray-600 focus:border-indigo-400/70"
            style={{
              color: textDraft.color,
              fontSize: Math.max(12, Math.min(40, textDraft.fontSize * camera.scale))
            }}
          />
          <div className="mt-1 flex items-center justify-between px-0.5 text-[10px] text-gray-500">
            <span>Ctrl+Enter — сохранить · Esc — отмена</span>
            <span>{textDraft.fontSize} px</span>
          </div>
        </div>
      )}

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
