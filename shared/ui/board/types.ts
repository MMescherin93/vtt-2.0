import type { DrawingInput, FogOfWarData, MapTextInput, MapTextPatch } from '../../types/map'
import type { Session } from '../../types/session'
import type { PlayerRole } from '../../types/session'

/** Запрос камеры к конкретной карте (seq меняется при каждом клике) */
export interface MapFocusRequest {
  mapId: string
  seq: number
}

/** Инструменты: выбор, перемещение, рисование, текст, туман войны */
export type Tool = 'select' | 'pan' | 'draw' | 'erase' | 'text' | 'fog'

/** Режимы инструмента «туман войны» (ТЗ, п.4) */
export type FogTool = 'brush' | 'eraser' | 'rect'

export interface DrawStyle {
  color: string
  /** Толщина линии в пикселях карты */
  size: number
}

export interface TokenTransform {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export interface BoardProps {
  session: Session
  role: PlayerRole
  tool: Tool
  drawStyle: DrawStyle
  /** Размер шрифта текста на карте */
  textSize: number
  fogTool: FogTool
  /** Толщина кисти тумана в пикселях карты */
  fogBrushSize: number
  /** GM: показывать туман полупрозрачно (игроки всегда видят непрозрачный) */
  showFogPreview: boolean
  /** Базовый URL сервера хоста для загрузки картинок */
  assetsBaseUrl: string
  /** Префикс для сохранения камеры (у каждого клиента своя — уточнение 2) */
  cameraKey: string
  selectedTokenId: string | null
  onSelectToken: (tokenId: string | null) => void
  onMoveToken: (tokenId: string, x: number, y: number) => void
  onTransformToken: (tokenId: string, data: TokenTransform) => void
  onAddDrawing: (drawing: DrawingInput) => void
  onAddText: (text: MapTextInput) => void
  onUpdateText: (patch: MapTextPatch) => void
  onRemoveText: (textId: string) => void
  onFogChange: (fog: FogOfWarData) => void
  /** Перетаскивание файлов на карту (GM: загрузка карты или токена в точку сброса) */
  onFilesDropped?: (files: File[], world: { x: number; y: number }) => void
  /** Показывать имена токенов (расширение «Подписи токенов») */
  showTokenLabels?: boolean
  /** Перелёт камеры к карте (мини-индикатор карт) */
  focusMap?: MapFocusRequest | null
  /** Какая карта сейчас в центре экрана */
  onActiveMapChange?: (mapId: string | null) => void
  disabled?: boolean
}
