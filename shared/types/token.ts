/** Кому показывать цифры статов */
export type StatsVisibility = 'full' | 'bar' | 'hidden'

/** Статы токена: HP/AC и режим их видимости */
export interface TokenStats {
  hp: number
  hpMax: number
  tempHp: number
  ac: number
  visibility: StatsVisibility
}

/** Токен существа/объекта на карте */
export interface Token {
  id: string
  /** Отображаемое имя (видно GM и игрокам, если токен не скрыт) */
  name: string
  /** Путь к изображению относительно папки сессии */
  imageUrl: string
  /** Координаты центра токена в пикселях карты */
  x: number
  y: number
  /** Размеры в пикселях карты */
  width: number
  height: number
  /** Поворот в градусах */
  rotation: number
  /** GM-only: скрыт от игроков (ТЗ, п.3) */
  hidden: boolean
  /** Запрет перемещения (по умолчанию false — двигать может любой участник) */
  locked: boolean
  /** Скрыть подпись именно этого токена */
  hideName: boolean
  /** HP/AC; null — статы не заданы или скрыты от этого клиента */
  stats: TokenStats | null
  /** Активные состояния (id из каталога) */
  conditions: string[]
  /** Только для игроков: доля HP 0..1, когда цифры скрыты */
  hpPercent?: number
  /** Только для игроков: доля временных HP 0..1 */
  tempPercent?: number
}
