import type { DrawingInput, FogOfWarData } from '../../types/map'
import type { Session } from '../../types/session'
import type { PlayerRole } from '../../types/session'

/** Инструменты (ТЗ, п.8): выбор, перемещение, рисование, туман войны */
export type Tool = 'select' | 'pan' | 'draw' | 'erase' | 'fog'

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
  onFogChange: (fog: FogOfWarData) => void
  /** Перетаскивание файлов на карту (GM: загрузка карты или токена в точку сброса) */
  onFilesDropped?: (files: File[], world: { x: number; y: number }) => void
  /** Показывать имена токенов (расширение «Подписи токенов») */
  showTokenLabels?: boolean
  disabled?: boolean
}
