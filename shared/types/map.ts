import type { TokenStats } from './token'

export type GridType = 'square' | 'hex' | 'none'

/** Как раскладывать карты на общем полотне */
export type MapLayout = 'horizontal' | 'vertical'

/** Настройки отображения карты (ТЗ, interface Session.settings) */
export interface MapSettings {
  gridType: GridType
  /** Размер ячейки сетки в пикселях карты */
  gridSize: number
  showGrid: boolean
  /** Цвет линий сетки (HEX) */
  gridColor: string
  /** Цвет подписей токенов (HEX) */
  tokenLabelColor: string
  /** Показывать имена токенов на карте */
  showTokenNames: boolean
  /** Карты в ряд слева направо или в столбец сверху вниз */
  mapLayout: MapLayout
}

/** Карта сессии: изображение и его размеры в пикселях */
export interface MapData {
  /** Относительный путь к изображению внутри папки сессии (ТЗ, уточнение 5) */
  imageUrl: string
  width: number
  height: number
}

/** Загруженная карта сессии (несколько карт лежат рядом на общем полотне) */
export interface MapAsset extends MapData {
  id: string
  /** Поворот карты в градусах вокруг центра */
  rotation?: number
  /** Масштаб карты (1 — исходный размер) */
  scale?: number
}

/**
 * Операция тумана войны.
 * reveal — убрать туман («окно»), conceal — закрасить туманом.
 * Применяется к базовому состоянию (FogOfWarData.covered) строго по порядку.
 */
export type FogOp =
  | {
      id: string
      op: 'reveal' | 'conceal'
      shape: 'rect'
      x: number
      y: number
      width: number
      height: number
    }
  | {
      id: string
      op: 'reveal' | 'conceal'
      shape: 'stroke'
      /** Точки ломаной [x1,y1,x2,y2,...] в пикселях карты */
      points: number[]
      /** Толщина кисти в пикселях карты */
      size: number
    }

/** Туман войны (ТЗ, п.4): кисть, ластик, выделение области */
export interface FogOfWarData {
  /** Закрыт ли весь лист туманом по умолчанию (true — игроки ничего не видят без reveal) */
  covered: boolean
  /** Операции поверх базового состояния, в порядке применения */
  ops: FogOp[]
}

/** Новая операция тумана (id назначается при добавлении) */
export type FogOpInput =
  Omit<Extract<FogOp, { shape: 'rect' }>, 'id'> | Omit<Extract<FogOp, { shape: 'stroke' }>, 'id'>

export type DrawingTool = 'pencil' | 'eraser'

/** Рисунок на whiteboard (ТЗ, п.5) */
export interface Drawing {
  id: string
  tool: DrawingTool
  /** HEX-цвет (для eraser не используется) */
  color: string
  /** Толщина линии в пикселях карты */
  size: number
  /** Точки ломаной [x1,y1,x2,y2,...] в пикселях карты */
  points: number[]
  /** Автор (рисовать могут все участники, не только GM) */
  authorId: string
  authorName: string
  createdAt: number
}

/** Данные нового рисунка от клиента (id/автора назначает сервер) */
export interface DrawingInput {
  tool: DrawingTool
  color: string
  size: number
  points: number[]
}

/** Текст на карте (инструмент «Текст») */
export interface MapText {
  id: string
  /** Левый верхний угол текста в пикселях мирового полотна */
  x: number
  y: number
  text: string
  /** HEX-цвет */
  color: string
  /** Размер шрифта в пикселях карты */
  fontSize: number
  authorId: string
  authorName: string
  createdAt: number
}

/** Новый текст от клиента (id/автора назначает сервер) */
export interface MapTextInput {
  x: number
  y: number
  text: string
  color: string
  fontSize: number
}

/** Изменение текста: позиция, содержимое или стиль */
export interface MapTextPatch {
  textId: string
  x?: number
  y?: number
  text?: string
  color?: string
  fontSize?: number
}

/** Изменение токена: позиция, размер, поворот и/или статы */
export interface TokenPatch {
  tokenId: string
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  /** Скрыть/показать подпись токена */
  hideName?: boolean
  /** Частичное обновление статов; null — сбросить */
  stats?: Partial<TokenStats> | null
  /** Полная замена списка состояний */
  conditions?: string[]
  /** Только для игроков: доля HP и временных HP */
  hpPercent?: number
  tempPercent?: number
}
